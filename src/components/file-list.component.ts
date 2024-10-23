import { Component, input, output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ParseNamePipe } from "../pipes/parse-name.pipe";

@Component({
  selector: "app-file-list",
  standalone: true,
  imports: [CommonModule, ParseNamePipe],
  template: `
    <div class="overflow_y_scroll flex_col grow">
      @for (file of files() ?? []; track file) {
        <div
          class="hover_cursor_pointer transition_border_width user_select_none border_fg4 bg_h"
          [ngClass]="{
            thick_border_l: activeFile() === file,
            rounded_tl: $first,
            rounded_bl: $last,
          }"
        >
          <div
            class="flex_row box padding space_between align_items hover_highlight_border w-full"
            [ngClass]="{
              bg: activeFile() === file,
              bg_h: activeFile() !== file,
              rounded_tl: $first,
              rounded_bl: $last,
              highlight_border:
                file === systemBar() || $index === highlightedFile,
            }"
            (click)="onClickedFile(file)"
          >
            <div
              class="align_items bg_h text_overflow_fade overflow_hidden grow flex"
              [ngClass]="{
                fg4: false,
                bg: activeFile() === file,
              }"
            >
              <span>
                {{ (file | parseName).name }}
                @for (tag of (file | parseName).tags; track tag) {
                  <span class="margin_l small_font color_bg3">#{{ tag }}</span>
                }
              </span>
            </div>
            <!-- File Extension -->
            <div class="text-right align_items">
              {{ (file | parseName).ext }}
            </div>
          </div>
        </div>
        <div class="pseudo_border"></div>
      }
    </div>
  `,
})
export class FileListComponent {
  systemBar = input.required<string>();
  files = input.required<string[] | null>();
  fileActivated = output<string>();
  activeFile = input.required<string | undefined>();
  highlightedFile: number = -1;

  public tabHighlightedFile() {
    const files = this.files();
    if (files !== null) {
      this.highlightedFile = (this.highlightedFile + 1) % files.length;
    }
  }

  public resetHighlightedFile() {
    this.highlightedFile = -1;
  }

  public onClickedFile(index: string) {
    this.fileActivated.emit(index);
  }
}
