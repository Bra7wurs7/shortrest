import { CommonModule } from "@angular/common";
import { AfterViewInit, Component, ElementRef, ViewChild } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { FileListEntry } from "../models/file-list-entry.model";
import { AuthorAssistantComponent } from "../components/author-assistant/author-assistant.component";
import { SimpleHttpRequest } from "../models/simple-http-request.model";
import { FormsModule } from "@angular/forms";
import { SystemAction } from "../models/system-action.model";
import { Folder } from "../models/folder.model";
import { FileListComponent } from "../components/file-list/file-list.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    AuthorAssistantComponent,
    FormsModule,
    FileListComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent implements AfterViewInit {
  title = "shortrest";

  public system_actions: SystemAction[] = [
    {
      name: "New File",
      description: "",
      icon: "iconoir-empty-page",
      command: "c",
      type: "create",
      action: (value: HTMLTextAreaElement) => {
        console.log(value);
      },
    },
    {
      name: "Read File",
      description: "",
      icon: "iconoir-page",
      command: "r",
      type: "read",
      action: (value: HTMLTextAreaElement) => {
        console.log(value);
      },
    },
    {
      name: "Edit File",
      description: "",
      icon: "iconoir-page-edit",
      command: "e",
      type: "edit",
      action: (value: HTMLTextAreaElement) => {
        console.log(value);
      },
    },
    {
      name: "Remove File",
      description: "",
      icon: "iconoir-bin-half",
      command: "rm",
      type: "delete",
      action: (value: HTMLTextAreaElement) => {
        console.log(value);
      },
    },
  ];

  activeFiles: FileListEntry[] = [
    {
      filename: "Unnamed File",
      tags: [],
      content: "",
      active: true,
      reading: true,
      children: [],
    },
  ];

  activeFolders: Folder[] = [];

  folders: Folder[] = [];

  ngAfterViewInit() {}

  llm: SimpleHttpRequest = {
    url: new URL("http://127.0.0.1:11434/v1/chat/completions"),
    method: "POST",
    headers: {},
    body: {},
    params: {},
  };
}
