import { Component, effect, inject, input, output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Context } from "../models/context.model";
import { FormsModule } from "@angular/forms";
import {
  OllamaChatBody,
  OllamaChatResponse,
  OllamaMessageRole,
} from "../models/ollama";
import { HttpFetchWrapperService } from "../services/http-client-wrapper/http-fetch-wrapper.service";
import { SimpleHttpRequest } from "../models/simple-http-request.model";
import { ParseMarkdownPipe } from "../pipes/parse-markdown.pipe";

@Component({
  selector: "app-prompt",
  standalone: true,
  imports: [FormsModule, ParseMarkdownPipe, CommonModule],
  template: `
    <div
      class="padding rounded_tr border_t border_l border_r bg_s flex_row hover_highlight_border user_select_none hover_cursor_pointer"
      [ngClass]="{
        margin_b: prompt().collapsed,
        rounded_b: prompt().collapsed,
        border_b: prompt().collapsed,
        rounded_tl: (index() ?? 0) > 0,
      }"
      (click)="prompt().collapsed = !prompt().collapsed; this.save.emit()"
    >
      <span
        class="icon hover_cursor_pointer color_fg4 hover_color_fg"
        [ngClass]="{
          'iconoir-cube': prompt().type === 'static',
          'iconoir-cube-hole': prompt().type === 'dynamic',
        }"
        (click)="onClickType(); $event.stopPropagation()"
      ></span>
      <span
        class="grow overflow_hidden bg_s text_overflow_fade margin_l"
        [ngClass]="{
          color_fg4: !prompt().visible,
        }"
        >{{ prompt().content }}</span
      >
      <span
        class="icon hover_cursor_pointer color_fg4 hover_color_fg"
        [ngClass]="{
          'iconoir-circle': !prompt().visible,
          'iconoir-check-circle': prompt().visible,
        }"
        (click)="prompt().visible = !prompt().visible; $event.stopPropagation()"
      ></span>
      <span
        class="icon iconoir-xmark-square hover_cursor_pointer color_fg4 hover_color_fg"
        (click)="remove.emit(); $event.stopPropagation()"
      ></span>
    </div>
    @if (!prompt().collapsed) {
      <div class="flex_row">
        @if (prompt().type === "dynamic") {
          <div class="flex_col bg_s">
            <div
              class="border flex_col centered_content padding hover_highlight_border bg_s color_fg4 hover_color_fg hover_cursor_pointer"
              title="Automatically trigger a generation request for the current dynamic contexts when the text changes"
              (click)="computeDynamicContext(this.prompt())"
            >
              <span class="icon iconoir-refresh-circle"></span>
            </div>
            <div
              class="border flex_col centered_content padding hover_highlight_border bg_s color_fg4 hover_color_fg hover_cursor_pointer"
              title="Automatically trigger a generation request for the current dynamic contexts when the text changes"
              [ngClass]="{
                color_fg: prompt().automatic_dynamic,
              }"
            >
              <span
                class="icon iconoir-fire-flame"
                (click)="
                  prompt().automatic_dynamic = !prompt().automatic_dynamic
                "
              ></span>
            </div>
            <div
              class="flex_row pseudo_input position_relative revive_children_on_hover"
              title="How many tokens of the text dynamic contexts get to read"
            >
              <span
                class="icon iconoir-eye-solid border padding hover_highlight_border hover_cursor_pointer color_fg4"
              ></span>
              <input
                class="width_10vw position_absolute from_right padding border top_0 collapse_but_allow_revival bg_h"
                type="number"
                style="appearance: textfield; -moz-appearance: textfield; width: 10vw;"
                [(ngModel)]="readTokens"
                placeholder="Read"
              />
            </div>
            <div
              class="flex_row pseudo_input  position_relative revive_children_on_hover"
              title="How large dynamic contexts may become in tokens"
            >
              <span
                class="icon iconoir-brain border padding hover_highlight_border hover_cursor_pointer color_fg4"
              ></span>
              <input
                class="top_0 padding border bg_h position_absolute from_right collapse_but_allow_revival"
                type="number"
                style="appearance: textfield; -moz-appearance: textfield; width: 10vw;"
                [(ngModel)]="writeTokens"
                placeholder="Think"
              />
            </div>
          </div>
        }
        <textarea
          #meta_context_textarea
          class="padding border_r border_color_bg_s font_size_small hover_highlight_border serif border_on_focus"
          rows="7"
          [(ngModel)]="prompt().content"
          [ngClass]="{
            rounded_b: prompt().type !== 'dynamic',
            margin_b: prompt().type !== 'dynamic',
            border_b: prompt().type !== 'dynamic',
            border_l: prompt().type !== 'dynamic',
            bg_s: !prompt().visible,
            color_fg4: !prompt().visible,
          }"
          (change)="save.emit()"
        ></textarea>
      </div>
      @if (prompt().type === "dynamic") {
        <div
          class="padding bg_s border_l border_r border_b _border border_color_bg_s rounded_b margin_b overflow_scroll font_size_small hover_highlight_border border_on_focus"
          rows="4"
          placeholder="Here, the language model will generate its thoughts on the text above, given a slice of the text on the center of the screen"
          [innerHtml]="prompt().dynamic_content | parseMarkdown | async"
        ></div>
      }
    }
  `,
})
export class PromptComponent {
  prompt = input.required<Context>();
  file = input.required<string | Blob>();
  llm = input.required<SimpleHttpRequest>();
  index = input<number>();
  save = output<void>();
  remove = output<void>();

  protected http = inject(HttpFetchWrapperService);

  constructor() {}

  writeTokens: number = 256;
  readTokens: number = 512;
  temperature: number = 1;
  seed: number = 0;
  top_k: number = 1;

  llmQueue?: Promise<void>;

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
      model: "dolphin-mistral", //dolphin-mistral
      format: "json",
      stream: true,
      max_tokens: +this.writeTokens,
      messages: [
        {
          role: "system",
          content: `${this.file().slice(-this.readTokens * 8) as string}`,
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
}
