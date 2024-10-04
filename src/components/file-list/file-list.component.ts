import { Component, input, output } from "@angular/core";
import { FileContent } from "../../models/file-content.model";
import { CommonModule } from "@angular/common";
import { ParseNamePipe } from "../../pipes/parse-name.pipe";

@Component({
  selector: "app-file-list",
  standalone: true,
  imports: [CommonModule, ParseNamePipe],
  templateUrl: "./file-list.component.html",
})
export class FileListComponent {
  files = input.required<Map<string, FileContent>>();
  fileActivated = output<string>();
  activeFile = input.required<number | undefined>();

  public onClickedFile(index: string) {
    this.fileActivated.emit(index);
  }
}
