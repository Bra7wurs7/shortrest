import { Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Context } from '../models/context.model';
import { FormsModule } from '@angular/forms';
import {
  OllamaChatBody,
  OllamaChatResponse,
  OllamaMessageRole,
} from '../models/ollama';
import { HttpFetchWrapperService } from '../services/http-client-wrapper/http-fetch-wrapper.service';
import { SimpleHttpRequest } from '../models/simple-http-request.model';

@Component({
  selector: 'app-prompt',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div
      class="padding rounded_t border_t border_l border_r bg_s flex_row hover_highlight_border user_select_none"
      [ngClass]="{
        margin_b: prompt().collapsed,
        rounded_b: prompt().collapsed,
        border_b: prompt().collapsed
      }"
    >
      <span
        class="icon hover_cursor_pointer fg4 hover_fg"
        [ngClass]="{
          'iconoir-cube': prompt().type === 'static',
          'iconoir-cube-hole': prompt().type === 'dynamic',
        }"
        (click)="onClickType()"
      ></span>
      <span
        class="grow overflow_hidden bg_s text_overflow_fade hover_cursor_pointer"
        (click)="prompt().collapsed = !prompt().collapsed; this.save.emit()"
        [ngClass]="{
          fg4: !prompt().visible,
        }"
        >{{ prompt().content }}</span
      >
      <span
        class="icon hover_cursor_pointer fg4 hover_fg"
        [ngClass]="{
          'iconoir-circle': !prompt().visible,
          'iconoir-check-circle': prompt().visible,
        }"
        (click)="prompt().visible = !prompt().visible"
      ></span>
      <span
        class="icon iconoir-xmark-square hover_cursor_pointer fg4 hover_fg"
        (click)="remove.emit()"
      ></span>
    </div>
    @if (!prompt().collapsed) {
    <div>
      @if (prompt().type === "dynamic") {
      <div class="flex_row bg_s">
        <div
          class="box flex_col centered_content padding hover_highlight_border bg_s"
          title="Automatically trigger a generation request for the current dynamic contexts when the text changes"
        >
          <span
            class="icon iconoir-refresh-circle hover_cursor_pointer fg4 hover_fg"
          ></span>
        </div>
        <div
          class="box flex_col centered_content padding hover_highlight_border bg_s"
          title="Automatically trigger a generation request for the current dynamic contexts when the text changes"
        >
          <span
            class="icon iconoir-fire-flame hover_cursor_pointer fg4 hover_fg"
          ></span>
        </div>
        <div
          class="flex_row box padding pseudo_input hover_highlight_border margin_r bg"
          title="How many tokens of the text dynamic contexts get to read"
        >
          <input class="flex" placeholder="Read" />
          <span class="icon iconoir-eye-solid hover_cursor_pointer fg4"></span>
        </div>
        <div
          class="flex_row box padding pseudo_input hover_highlight_border bg"
          title="How large dynamic contexts may become in tokens"
        >
          <input class="flex" placeholder="Think" />
          <span class="icon iconoir-brain hover_cursor_pointer fg4"></span>
        </div>
      </div>
      }
      <textarea
        #meta_context_textarea
        class="padding border_l border_r border_bg_s hover_highlight_border bg_s serif"
        rows="10"
        [(ngModel)]="prompt().content"
        [ngClass]="{
          fg4: prompt().type === 'dynamic' || !prompt().visible,
          rounded_b: prompt().type !== 'dynamic',
          margin_b: prompt().type !== 'dynamic',
          border_b: prompt().type !== 'dynamic',
        }"
        (change)="save.emit()"
      ></textarea>
      @if (prompt().type === "dynamic") {
      <textarea
        class="padding bg_h border_l border_r border_b border_bg_s rounded_b margin_b overflow_scroll small_font hover_highlight_border"
        rows="5"
        placeholder="Here, the language model will generate its thoughts on the text above, given a slice of the text on the center of the screen"
        [(ngModel)]="prompt().dynamic_content"
      >
      </textarea>
      }
    </div>

    }
  `,
})
export class PromptComponent {
  prompt = input.required<Context>();
  file = input.required<string | Blob>();
  llm = input.required<SimpleHttpRequest>();
  save = output<void>();
  remove = output<void>();

  protected http = inject(HttpFetchWrapperService);

  constructor() {}

  writeTokens: number = 0;
  readTokens: number = 0;
  temperature: number = 0.5;
  seed: number = 0;
  top_k: number = 1;

  protected onClickType() {
    switch (this.prompt().type) {
      case 'dynamic':
        this.prompt().type = 'static';
        break;
      case 'static':
        this.prompt().type = 'dynamic';
        break;
    }
    this.save.emit();
  }

  protected computeDynamicContext(context: Context) {
    context.dynamic_content = '';
    const sysRole: OllamaMessageRole = 'system';
    const body: OllamaChatBody = {
      model: 'dolphin-mistral', //dolphin-mistral
      format: 'json',
      stream: true,
      max_tokens: +this.writeTokens,
      messages: [
        {
          role: 'assistant',
          content: `${this.file().slice(-this.readTokens * 8) as string}`,
        },
        {
          role: 'user',
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
