import { Component, input } from "@angular/core";
import { FileListEntry } from "../../models/file-list-entry.model";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-file-list-entry",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./file-list-entry.component.html",
  styleUrl: "./file-list-entry.component.scss",
})
export class FileListEntryComponent {
  file = input.required<FileListEntry>();
  isChild = input<boolean>(false);

  log(a: any) {
    console.log(a);
  }
}
