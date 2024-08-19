import { Component, input } from "@angular/core";
import { FileListEntryComponent } from "../file-list-entry/file-list-entry.component";
import { File } from "../../models/file.model";

@Component({
  selector: "app-file-list",
  standalone: true,
  imports: [FileListEntryComponent],
  templateUrl: "./file-list.component.html",
  styleUrl: "./file-list.component.scss",
})
export class FileListComponent {
  files = input.required<File[]>();
}
