import { Component, input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FileListEntry } from "../../models/file-list-entry.model";

@Component({
  selector: "app-file-list-entry",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./file-list-entry.component.html",
  styleUrl: "./file-list-entry.component.scss",
})
export class FileListEntryComponent {
  file = input.required<FileListEntry>();
  active = input<boolean>(false);
  isChild = input<boolean>(false);
}
