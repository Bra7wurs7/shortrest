import { Component, OnInit, input, EventEmitter, output, inject } from "@angular/core";
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
        class="icon hover_cursor_pointer color_fg4 hover_color_fg position_relative revive_children_on_hover"
        [ngClass]="{
          'iconoir-cube': prompt().type === 'static',
          'iconoir-cube-hole': prompt().type === 'dynamic',
          'rounded_l': prompt().type === 'dynamic',
          'hover_bg_h': prompt().type === 'dynamic',
        }"
        (click)="onClickType(); this.save.emit(); $event.stopPropagation()"
      >
        <span
          class="top_0 rounded_r border bg_h position_absolute white_space_nowrap from_right collapse_but_allow_revival font_size_small z_index_2" [ngClass]="{
            rounded_l: prompt().type === 'static',
          }"
        >
          @if (prompt().type === "static") {
            Static context
          }
          @if (prompt().type === "dynamic") {
            Dynamic context
          }
        </span></span
      >
      <span
        class="grow overflow_hidden bg_s text_overflow_fade margin_l"
        [ngClass]="{
          color_fg4: !prompt().visible,
        }"
        >{{ prompt().content }}</span
      >
      <span
        class="icon hover_cursor_pointer color_fg4 hover_color_fg position_relative revive_children_on_hover"
        [ngClass]="{
          'iconoir-circle': !prompt().visible,
          'iconoir-check-circle': prompt().visible,
        }"
        (click)="
          prompt().visible = !prompt().visible;
          this.save.emit();
          $event.stopPropagation()
        "
      >
        <span
          class="left_0 rounded border bg_h position_absolute from_bottom writing_mode_v_lr white_space_nowrap collapse_but_allow_revival font_size_small z_index_2"
        >
          @if (prompt().visible) {
            Context visible
          }
          @if (!prompt().visible) {
            Context hidden
          }
        </span>
      </span>
      <span
        class="icon iconoir-xmark-square hover_cursor_pointer color_fg4 hover_color_fg position_relative revive_children_on_hover"
        (click)="remove.emit(); this.save.emit(); $event.stopPropagation()"
      >
        <span
          class="left_0 rounded border bg_h position_absolute from_bottom writing_mode_v_lr white_space_nowrap collapse_but_allow_revival font_size_small z_index_2"
        >
          Remove context
        </span>
      </span>
    </div>
    @if (!prompt().collapsed) {
      <div class="flex_row">
        @if (prompt().type === "dynamic") {
          <div class="flex_col bg_s">
            <div
              class="position_relative flex_row color_fg4 hover_color_fg hover_cursor_pointer revive_children_on_hover"
              (click)="computeDynamicContext(this.prompt())"
            >
              <span
                class="icon iconoir-refresh-circle border padding hover_highlight_border"
              ></span>
              <span
                class="top_0 padding rounded_br border bg_h position_absolute from_right collapse_but_allow_revival font_size_small z_index_2"
                style="width: 10vw"
                >Click to generate dynamic context</span
              >
            </div>
            <div
              class="position_relative color_fg4 hover_color_fg hover_cursor_pointer revive_children_on_hover"
              (click)="
                prompt().automatic_dynamic = !prompt().automatic_dynamic;
                this.save.emit()
              "
            >
              <span
                class="icon iconoir-bonfire border padding hover_highlight_border"
                [ngClass]="{
                  fire: prompt().automatic_dynamic,
                  'hover_bg_h': prompt().automatic_dynamic,
                }"
              ></span>
              <span
                class="top_0 padding rounded_r border bg_h position_absolute from_right collapse_but_allow_revival font_size_small z_index_2"
                style="width: 10vw"
                >Automatically update dynamic context when the text
                changes</span
              >
            </div>
            <div
              class="flex_row pseudo_input position_relative revive_children_on_hover color_fg4 hover_color_fg"
              title="How many tokens of the text dynamic contexts get to read"
            >
              <span
                class="icon iconoir-eye-solid border padding hover_highlight_border hover_cursor_pointer"
              ></span>
              <input
                #readTokensInput
                class="position_absolute rounded_r from_right padding border border_bottom_color_fg4 top_0 collapse_but_allow_revival bg_h hover_highlight_border"
                type="number"
                step="128"
                style="width: 5vw;"
                [(ngModel)]="readTokens"
                (change)="this.save.emit()"
                placeholder="Read"
              />
            </div>
            <div
              class="flex_row pseudo_input position_relative revive_children_on_hover color_fg4 hover_color_fg"
              title="How large dynamic contexts may become in tokens"
            >
              <span
                class="icon iconoir-brain border padding hover_highlight_border hover_cursor_pointer"
              ></span>
              <input
                #writeTokensInput
                class="top_0 padding border rounded_tr border_bottom_color_fg4 bg_h position_absolute from_right collapse_but_allow_revival hover_highlight_border"
                type="number"
                step="128"
                style="width: 5vw;"
                [(ngModel)]="writeTokens"
                (change)="this.save.emit()"
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
  `
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

  writeTokens: number = 384;
  readTokens: number = 384;
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
