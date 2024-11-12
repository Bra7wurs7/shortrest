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
          class="hover_cursor_pointer transition_border_width user_select_none border_color_fg4 bg_h margin_b"
          [ngClass]="{
            border_l_thick: activeFile() === file,
          }"
        >
          <div
            class="flex_row border padding space_between align_items hover_highlight_border w-full"
            [ngClass]="{
              bg: activeFile() === file,
              bg_h: activeFile() !== file,
              highlight_border:
                file === systemBar() || $index === highlightedFile,
            }"
            (click)="onClickedFile(file)"
          >
            <div
              class="align_items bg_h text_overflow_fade overflow_hidden grow flex"
              [ngClass]="{
                bg: activeFile() === file,
              }"
            >
              <span>
                {{ (file | parseName).name }}
                @for (tag of (file | parseName).tags; track tag) {
                  <span class="margin_l font_size_small color_border_color">#{{ tag }}</span>
                }
              </span>
            </div>
            <!-- File Extension -->
            <div class="text-right align_items">
              {{ (file | parseName).ext }}
            </div>
          </div>
        </div>
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

  public iterateHighlightedFiles() {
    const files = this.files();
    if (files !== null && this.highlightedFile !== 0) {
      // Start from the last index and decrement to iterate backwards, but skip it when the first element is highlighted
      this.highlightedFile =
        this.highlightedFile === -1
          ? files.length - 1
          : this.highlightedFile - 1;
    } else {
      // If files are null or if the first element is highlighted, set it to none
      this.resetHighlightedFile();
    }
  }

  public resetHighlightedFile() {
    this.highlightedFile = -1;
  }

  public onClickedFile(index: string) {
    this.fileActivated.emit(index);
  }
}
