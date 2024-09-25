import { Component, input, output } from "@angular/core";
import { NamedNode } from "../../models/node.model";
import { CommonModule } from "@angular/common";
import { ParseNamePipe } from "../../pipes/parse-name.pipe";

@Component({
  selector: "app-file-list",
  standalone: true,
  imports: [CommonModule, ParseNamePipe],
  templateUrl: "./file-list.component.html",
})
export class FileListComponent {
  files = input.required<NamedNode[]>();
  fileActivated = output<number>();
  activeFile = input.required<number | undefined>();

  public onClickedFile(index: number) {
    this.fileActivated.emit(index);
  }
}
