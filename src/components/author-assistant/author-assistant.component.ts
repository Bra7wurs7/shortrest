import { Component, computed, effect, input } from "@angular/core";
import { FileListEntry } from "../../models/file-list-entry.model";
import { HttpRequest } from "@angular/common/http";
import { SimpleHttpRequest } from "../../models/simple-http-request.model";
import { FormsModule } from "@angular/forms";
import { OllamaChatBody, OllamaChatResponse } from "../../models/llm/ollama";
import { HttpFetchWrapperService } from "../../services/http-client-wrapper/http-fetch-wrapper.service";
import { CommonModule } from "@angular/common";
import { Context } from "./context.model";

@Component({
  selector: "app-author-assistant",
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: "./author-assistant.component.html",
  styleUrl: "./author-assistant.component.scss",
})
export class AuthorAssistantComponent {
  localStorage = localStorage;
  file = input.required<FileListEntry>();
  llm = input.required<SimpleHttpRequest>();
  public context_prompts: Context[] = [];

  public readTokens: number = 256;
  public rememberTokens: number = 1024;
  public writeTokens: number = 128;

  public seed: number = 0;
  public temperature: number = 0.5;
  public top_k: number = 1;

  public constructor(private readonly http: HttpFetchWrapperService) {
    this.loadContext();
  }

  public onAddContextClick() {
    this.context_prompts.push({
      collapsed: false,
      type: "static",
      content: "",
      dynamic_content: "",
      visible: true,
    });
    this.saveContext();
  }

  public onRemoveContextClick(i: number) {
    this.context_prompts.splice(i, 1);
    this.saveContext();
  }

  public saveContext() {
    this.localStorage.setItem("context", JSON.stringify(this.context_prompts));
  }

  public loadContext() {
    const context = this.localStorage.getItem("context");
    if (context) {
      this.context_prompts = JSON.parse(context);
    }
  }

  public computeContexts() {
    for (const context of this.context_prompts) {
      switch (context.type) {
        case "dynamic":
          this.computeDynamicContext(context);
          break;
        case "static":
          break;
      }
    }
  }

  public computeDynamicContext(context: Context) {
    context.dynamic_content = "";
    const body: OllamaChatBody = {
      model: "dolphin-mistral",
      format: "json",
      stream: true,
      messages: [
        {
          role: "system",
          content: `You answer questions about any kind of text excerpt. You formulate the answer that can be understood without having read the question.`,
        },
        {
          role: "assistant",
          content: `${this.file().content}`,
        },
        {
          role: "user",
          content: context.content,
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
          context.dynamic_content += fragment.choices[0].delta.content;
          if (fragment.done) {
            sub?.unsubscribe();
          }
        }
      });
    });
  }

  public onClickType(i: number) {
    switch (this.context_prompts[i].type) {
      case "dynamic":
        this.context_prompts[i].type = "static";
        break;
      case "static":
        this.context_prompts[i].type = "dynamic";
        break;
    }
    this.saveContext();
  }

  public buildPrompt(): SimpleHttpRequest {
    const activeContexts: Context[] = this.context_prompts.filter(
      (c) => c.visible,
    );
    const body: OllamaChatBody = {
      model: "dolphin-mistral",
      format: "json",
      stream: true,
      messages: [
        {
          role: "system",
          content: activeContexts
            .map((c) => {
              switch (c.type) {
                case "dynamic":
                  return c.dynamic_content;
                  break;
                case "static":
                  return c.content;
                  break;
              }
            })
            .join("\n"),
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
          if (fragment.done) {
            sub?.unsubscribe();
            this.computeContexts();
          }
        }
      });
    });

    return { ...this.llm(), body: body };
  }
}
