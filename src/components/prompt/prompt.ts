import {
  Component,
  OnInit,
  input,
  EventEmitter,
  output,
  inject,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { Context } from "../../models/context.model";
import { FormsModule } from "@angular/forms";
import {
  OllamaChatBody,
  OllamaChatResponse,
  OllamaMessageRole,
} from "../../models/ollama";
import { HttpFetchWrapperService } from "../../services/http-client-wrapper/http-fetch-wrapper.service";
import { SimpleHttpRequest } from "../../models/simple-http-request.model";
import { ParseMarkdownPipe } from "../../pipes/parse-markdown.pipe";

@Component({
  selector: "app-prompt",
  imports: [FormsModule, ParseMarkdownPipe, CommonModule],
  templateUrl: "prompt.html",
})
export class PromptComponent implements OnInit {
  prompt = input.required<Context>();
  file = input.required<string | Blob>();
  llm = input.required<SimpleHttpRequest>();
  generateDynamicContext = input.required<EventEmitter<void>>();
  fileChange = input.required<EventEmitter<void>>();
  index = input<number>();
  save = output<void>();
  remove = output<void>();

  llmQueue?: Promise<void>;

  protected http = inject(HttpFetchWrapperService);

  constructor() {}

  ngOnInit(): void {
    this.generateDynamicContext().subscribe(() => {
      if (this.prompt().type === "dynamic") {
        this.computeDynamicContext(this.prompt());
      }
    });
    this.fileChange().subscribe(() => {
      if (this.prompt().automatic_dynamic && this.prompt().type === "dynamic") {
        this.computeDynamicContext(this.prompt());
      }
    });
  }

  protected onClickType() {
    switch (this.prompt().type) {
      case "dynamic":
        this.prompt().type = "static";
        break;
      case "static":
        this.prompt().type = "dynamic";
        break;
    }
    this.save.emit();
  }

  protected computeDynamicContext(context: Context) {
    context.dynamic_content = "";
    const sysRole: OllamaMessageRole = "system";
    const body: OllamaChatBody = {
      //model: "dolphin-mistral",
      model: "dolphin-mistral",
      format: "json",
      stream: true,
      max_tokens: +context.writeTokens,
      messages: [
        {
          role: "user",
          content: `${this.file().slice(-context.readTokens * 8) as string}\n\n${context.content}`,
        },
      ],
      options: {
        temperature: context.temperature,
        seed: context.seed,
        top_k: context.top_k,
      },
    };

    this.http.streamPrompt({ ...this.llm(), body: body }).then((o) => {
      const sub = o?.stream.subscribe((streamFragment) => {
        const asTyped = streamFragment as unknown as OllamaChatResponse[];
        for (const fragment of asTyped) {
          context.dynamic_content += fragment.choices[0].delta.content;
          if (fragment.choices[0].finish_reason !== null) {
            sub?.unsubscribe();
            this.save.emit();
          }
        }
      });
    });
  }
}
