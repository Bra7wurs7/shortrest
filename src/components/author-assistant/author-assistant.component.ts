import { Component, input, output } from "@angular/core";
import { FileListEntry } from "../../models/file-list-entry.model";
import { SimpleHttpRequest } from "../../models/simple-http-request.model";
import { FormsModule } from "@angular/forms";
import {
  OllamaChatBody,
  OllamaChatResponse,
  OllamaMessageRole,
} from "../../models/llm/ollama";
import { HttpFetchWrapperService } from "../../services/http-client-wrapper/http-fetch-wrapper.service";
import { CommonModule } from "@angular/common";
import { Context } from "./context.model";
import { FileContent } from "../../models/file-content.model";

@Component({
  selector: "app-author-assistant",
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: "./author-assistant.component.html",
})
export class AuthorAssistantComponent {
  file = input.required<string | Blob>();
  llm = input.required<SimpleHttpRequest>();
  token = output<string>();

  protected  context_prompts: Context[] = [];
  protected readTokens: string = "384";
  protected writeTokens: string = "128";

  protected contextReadTokens: string = "1024";
  protected contextWriteTokens: string = "256";

  protected autoGenerateDynamicContexts: boolean = false;

  protected seed: number = 0;
  protected temperature: number = 0.5;
  protected top_k: number = 1;

  public constructor(private readonly http: HttpFetchWrapperService) {
    this.loadContext();
  }

  public addInformation(information: string | Blob) {
    if (information instanceof Blob) {
      throw Error("Not Implemented")
    }
    this.context_prompts.push({
      collapsed: false,
      visible: false,
      type: "static",
      content: information,
      dynamic_content: ""
    })
  }

  protected onAddContextClick() {
    this.context_prompts.push({
      collapsed: false,
      type: "static",
      content: "",
      dynamic_content: "",
      visible: true,
    });
    this.saveContext();
  }

  protected onRemoveContextClick(i: number) {
    this.context_prompts.splice(i, 1);
    this.saveContext();
  }

  protected saveContext() {
    localStorage.setItem("context", JSON.stringify(this.context_prompts));
  }

  protected loadContext() {
    const context = localStorage.getItem("context");
    if (context) {
      this.context_prompts = JSON.parse(context);
    }
  }

  protected computeContexts() {
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

  protected computeDynamicContext(context: Context) {
    context.dynamic_content = "";
    const sysRole: OllamaMessageRole = "system";
    const systemMessages = this.context_prompts
      .filter(
        (c: Context, i: number) =>
          c.visible &&
          c !== context &&
          (c.type == "static" ? c.content : c.dynamic_content) !== "",
      )
      .map((c: Context) => {
        return {
          role: sysRole,
          content: c.type == "static" ? c.content : c.dynamic_content,
        };
      });
    const body: OllamaChatBody = {
      model: "dolphin-mistral",
      format: "json",
      stream: true,
      max_tokens: +this.contextWriteTokens,
      messages: [
        ...systemMessages,
        {
          role: "assistant",
          content: `${
            this.file().slice(-this.contextReadTokens * 8) as string
          }`,
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

  protected onClickType(i: number) {
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
      max_tokens: +this.writeTokens,
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
          content: this.file().slice(-this.readTokens * 4) as string,
        },
      ],
      options: {
        temperature: this.temperature,
        seed: this.seed,
        top_k: this.top_k,
      },
    };

    this.http.streamPrompt({ ...this.llm(), body: body }).then((o) => {
      const sub = o?.subscribe((streamFragment) => {
        const asTyped = streamFragment as unknown as OllamaChatResponse[];
        for (const fragment of asTyped) {
          this.token.emit(fragment.choices[0].delta.content);
          if (fragment.done) {
            sub?.unsubscribe();
            this.computeContexts();
            this.token.emit('');
            if (this.autoGenerateDynamicContexts) {
              this.onClickReloadDynamicContexts();
            }
          }
        }
      });
    });

    return { ...this.llm(), body: body };
  }

  protected onClickReloadDynamicContexts() {
    for (const context of this.context_prompts) {
      if (context.type === "dynamic") {
        this.computeDynamicContext(context);
      }
    }
  }
}
