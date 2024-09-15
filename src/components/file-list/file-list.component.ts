import { Component, input } from "@angular/core";
import { FileListEntryComponent } from "../file-list-entry/file-list-entry.component";
import { FileListEntry } from "../../models/file-list-entry.model";

@Component({
  selector: "app-file-list",
  standalone: true,
  imports: [FileListEntryComponent],
  templateUrl: "./file-list.component.html",
  styleUrl: "./file-list.component.scss",
})
export class FileListComponent {
  files = input.required<FileListEntry[]>();
}
