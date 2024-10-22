import { Component, input, output } from "@angular/core";
import { FileListEntry } from "../models/file-list-entry.model";
import { SimpleHttpRequest } from "../models/simple-http-request.model";
import { FormsModule } from "@angular/forms";
import {
  OllamaChatBody,
  OllamaChatResponse,
  OllamaMessageRole,
} from "../models/ollama";
import { HttpFetchWrapperService } from "../services/http-client-wrapper/http-fetch-wrapper.service";
import { CommonModule } from "@angular/common";
import { Context } from "../models/context.model";

@Component({
  selector: "app-author-assistant",
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div
      class="flex_col sidebar_width bg grow space_between overflow_hidden margin_b rounded_tl"
    >
      <div class="flex_col padding overflow_scroll">
        @for (prompt of context_prompts; track prompt) {
          <div
            class="padding rounded_t box bg_s flex_row hover_highlight_border user_select_none"
            [ngClass]="{
              margin_b: prompt.collapsed,
              rounded_b: prompt.collapsed,
            }"
          >
            <span
              class="icon hover_cursor_pointer fg4 hover_fg"
              [ngClass]="{
                'iconoir-cube': prompt.type === 'static',
                'iconoir-cube-hole': prompt.type === 'dynamic',
              }"
              (click)="onClickType($index)"
            ></span>
            @if (prompt.type === "dynamic") {
              <span
                class="icon iconoir-refresh-circle hover_cursor_pointer fg4 hover_fg"
                (click)="computeDynamicContext(prompt)"
              ></span>
            }
            <span
              class="grow overflow_hidden bg_s text_overflow_fade hover_cursor_pointer"
              (click)="prompt.collapsed = !prompt.collapsed; this.saveContext()"
              [ngClass]="{
                fg4: !prompt.visible,
              }"
              >{{ prompt.content }}</span
            >
            <span
              class="icon hover_cursor_pointer fg4 hover_fg"
              [ngClass]="{
                'iconoir-circle': !prompt.visible,
                'iconoir-check-circle': prompt.visible,
              }"
              (click)="prompt.visible = !prompt.visible"
            ></span>
            <span
              class="icon iconoir-xmark-square hover_cursor_pointer fg4 hover_fg"
              (click)="onRemoveContextClick($index); this.saveContext()"
            ></span>
          </div>
          @if (!prompt.collapsed) {
            <textarea
              #meta_context_textarea
              class="padding border_l border_r border_bg_s hover_highlight_border"
              rows="10"
              [(ngModel)]="prompt.content"
              [ngClass]="{
                fg4: prompt.type === 'dynamic' || !prompt.visible,
                rounded_b: prompt.type !== 'dynamic',
                margin_b: prompt.type !== 'dynamic',
                border_b: prompt.type !== 'dynamic',
                bg_h: prompt.type === 'static',
              }"
              (change)="saveContext()"
            ></textarea>
            @if (prompt.type === "dynamic") {
              <textarea
                class="padding bg_h box border_bg_s rounded_b margin_b overflow_scroll small_font hover_highlight_border"
                rows="5"
                placeholder="In this textbox, the language model will generate a context to the text readable to it. based on the slice of the text readable to the llm. (and other context prompts, if enabled)"
                [(ngModel)]="prompt.dynamic_content"
              >
              </textarea>
            }
          }
        }
        <div
          class="box rounded padding flex_row space_between hover_highlight_border bg_s hover_cursor_pointer fg4 hover_fg"
          [ngClass]="{
            rounded_tr: context_prompts.length === 0,
          }"
          (click)="onAddContextClick()"
        >
          <span
            class="overflow_hidden grow text_overflow_fade bg_s user_select_none"
            >Provide information</span
          >
          <span class="icon iconoir-plus"></span>
        </div>
      </div>

      <div class="flex_col padding">
        <div class="flex_row margin_b">
          <div class="margin_r flex_col">
            <div
              class="flex_row rounded_tl box padding pseudo_input hover_highlight_border bg_h margin_b grow"
              title="How many text tokens into the past the LLM gets to read before starting to produce a continuation."
            >
              <input
                class="flex"
                placeholder="Read Tokens"
                [(ngModel)]="readTokens"
              />
              <span
                class="icon iconoir-data-transfer-up hover_cursor_pointer fg4"
              ></span>
            </div>
            <div
              class="flex_row box padding pseudo_input hover_highlight_border bg_h grow"
              title="The amount of new text tokens the LLM may produce before being terminated"
            >
              <input
                class="flex"
                placeholder="Write Tokens"
                [(ngModel)]="writeTokens"
              />
              <span
                class="icon iconoir-data-transfer-down hover_cursor_pointer fg4"
              ></span>
            </div>
          </div>
          <div class="flex_col margin_r">
            <div
              class="flex_row box padding pseudo_input hover_highlight_border bg_h margin_b"
              title="How many tokens of the text dynamic contexts get to read"
            >
              <input
                class="flex"
                placeholder="Read Tokens"
                [(ngModel)]="contextReadTokens"
              />
              <span
                class="icon iconoir-xray-view hover_cursor_pointer fg4"
              ></span>
            </div>
            <div
              class="flex_row box padding pseudo_input hover_highlight_border bg_h"
              title="How large dynamic contexts may become in tokens"
            >
              <input
                class="flex"
                placeholder="Write Tokens"
                [(ngModel)]="contextWriteTokens"
              />
              <span class="icon iconoir-cube hover_cursor_pointer fg4"></span>
            </div>
          </div>
          <div class="flex_col">
            <div
              class="box flex_col centered_content rounded_tr padding fg4 hover_highlight_border bg_s margin_b"
              title="Trigger a generation request for the current dynamic contexts"
            >
              <span
                class="icon iconoir-reload-window hover_cursor_pointer"
                (click)="onClickReloadDynamicContexts()"
              ></span>
            </div>
            <div
              class="box flex_col centered_content padding hover_highlight_border bg_s"
              title="Automatically trigger a generation request for the current dynamic contexts when the text changes"
              [ngClass]="{
                fg1: autoGenerateDynamicContexts,
                fg4: !autoGenerateDynamicContexts,
              }"
              (click)="
                autoGenerateDynamicContexts = !autoGenerateDynamicContexts
              "
            >
              <span
                class="icon iconoir-refresh-circle-solid hover_cursor_pointer"
              ></span>
            </div>
          </div>
        </div>
        <div class="flex_row">
          <div
            class="flex_row rounded_bl box padding pseudo_input hover_highlight_border bg_h margin_r"
            title="Seed: number that all random number generation is based on"
          >
            <input
              class="flex"
              placeholder="Randomness Seed"
              [(ngModel)]="seed"
            />
            <span class="icon iconoir-soil-alt hover_cursor_pointer fg4"></span>
          </div>
          <div>
            <div
              class="flex_row box padding pseudo_input hover_highlight_border bg_h margin_b"
              title="Randomness (temperature): higher settings make more probable next token options more likely"
            >
              <input
                class="flex"
                placeholder="Randomness"
                [(ngModel)]="temperature"
              />
              <span
                class="icon iconoir-dice-six hover_cursor_pointer fg4"
              ></span>
            </div>
            <div
              class="flex_row box rounded_br padding pseudo_input hover_highlight_border bg_h"
              title="Variety (top_k): the portion of next token options to consider at all"
            >
              <input class="flex" placeholder="Variety" [(ngModel)]="top_k" />
              <span
                class="icon iconoir-palette hover_cursor_pointer fg4"
              ></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex_col sidebar_width">
      <div class="flex_row">
        <div
          class="box rounded_bl padding flex_row grow hover_cursor_pointer hover_highlight_border bg fg4 hover_fg overflow_hidden"
          (click)="buildPrompt()"
        >
          <span class="overflow_hidden grow text_overflow_fade bg"
            >Continue Text</span
          >
          <span class="icon iconoir-brain-electricity margin_r"></span>
        </div>
      </div>
    </div>
  `,
})
export class AuthorAssistantComponent {
  file = input.required<string | Blob>();
  llm = input.required<SimpleHttpRequest>();
  token = output<string>();

  protected context_prompts: Context[] = [];
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
      throw Error("Not Implemented");
    }
    this.context_prompts.push({
      collapsed: false,
      visible: false,
      type: "static",
      content: information,
      dynamic_content: "",
    });
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
      model: "dolphin-mistral", //dolphin-mistral
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
            this.token.emit("");
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
