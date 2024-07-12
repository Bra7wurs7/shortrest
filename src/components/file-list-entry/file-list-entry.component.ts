import { Component, input } from "@angular/core";
import { fileListEntry } from "../../models/file-list-entry.model";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-file-list-entry",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./file-list-entry.component.html",
  styleUrl: "./file-list-entry.component.scss",
})
export class FileListEntryComponent {
  file = input<fileListEntry>();
}
