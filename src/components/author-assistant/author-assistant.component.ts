import { Component, computed, effect, input } from "@angular/core";
import { FileListEntry } from "../../models/file-list-entry.model";
import { HttpRequest } from "@angular/common/http";
import { SimpleHttpRequest } from "../../models/simple-http-request.model";
import { FormsModule } from "@angular/forms";
import { OllamaChatBody, OllamaChatResponse } from "../../models/llm/ollama";
import { HttpFetchWrapperService } from "../../services/http-client-wrapper.ts/http-fetch-wrapper.service";

@Component({
  selector: "app-author-assistant",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./author-assistant.component.html",
  styleUrl: "./author-assistant.component.scss",
})
export class AuthorAssistantComponent {
  localStorage = localStorage;
  file = input.required<FileListEntry>();
  llm = input.required<SimpleHttpRequest>();
  public meta_context: string = "";

  public readTokens: number = 1024;
  public writeTokens: number = 512;

  public seed: number = 0;
  public temperature: number = 0.5;
  public top_k: number = 1;

  public constructor(private readonly http: HttpFetchWrapperService) {
    this.meta_context = this.localStorage.getItem("meta_context") ?? "";
  }

  public buildPrompt(): SimpleHttpRequest {
    const body: OllamaChatBody = {
      model: "dolphin-mistral",
      format: "json",
      stream: true,
      messages: [
        {
          role: "system",
          content: `${this.meta_context}`,
        },
        {
          role: "assistant",
          content: this.file().content.slice(-this.readTokens * 4),
        },
      ],
      options: {
        temperature: this.temperature,
        seed: this.seed,
        top_k: this.top_k,
        num_predict: this.writeTokens,
      },
    };

    this.http.streamPrompt({ ...this.llm(), body: body }).then((o) => {
      const sub = o?.subscribe((streamFragment) => {
        const asTyped = streamFragment as unknown as OllamaChatResponse[];
        for (const fragment of asTyped) {
          this.file().content += fragment.choices[0].delta.content;
          console.log(fragment.choices.length);
        }
      });
    });

    return { ...this.llm(), body: body };
  }
}
