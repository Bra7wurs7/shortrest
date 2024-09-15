import { CommonModule } from "@angular/common";
import { AfterViewInit, Component, ElementRef, ViewChild } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { FileListEntry } from "../models/file-list-entry.model";
import { AuthorAssistantComponent } from "../components/author-assistant/author-assistant.component";
import { SimpleHttpRequest } from "../models/simple-http-request.model";
import { FormsModule } from "@angular/forms";
import { SystemAction } from "../models/system-action.model";
import { NamedNodeMap } from "../models/named-node-list.model";
import { FileListComponent } from "../components/file-list/file-list.component";
import { NamedNode } from "../models/node.model";

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
      visibleRegex: new RegExp(".*"),
      name: "List Files",
      description: "",
      icon: "iconoir-list",
      command: "c",
      type: "create",
      action: (value: HTMLTextAreaElement) => {
        this.newFile(this.folders[this.activeFolder].nodes, value.value);
      },
    },
    {
      visibleRegex: new RegExp(".*"),
      name: "New File",
      description: "",
      icon: "iconoir-empty-page",
      command: "c",
      type: "create",
      action: (value: HTMLTextAreaElement) => {
        this.newFile(this.folders[this.activeFolder].nodes, value.value);
      },
    },
    {
      visibleRegex: new RegExp(""),
      name: "Read File",
      description: "",
      icon: "iconoir-page",
      command: "r",
      type: "read",
      action: (value: HTMLTextAreaElement) => {
        this.openFile(this.folders[this.activeFolder].nodes, value.value)
        this.editFile(value.value)
      },
    },
    {
      visibleRegex: new RegExp(""),
      name: "Edit File",
      description: "",
      icon: "iconoir-page-edit",
      command: "e",
      type: "edit",
      action: (value: HTMLTextAreaElement) => {
        this.editFile(value.value)
      },
    },
    {
      visibleRegex: new RegExp(""),
      name: "Remove File",
      description: "",
      icon: "iconoir-bin-half",
      command: "rm",
      type: "delete",
      action: (value: HTMLTextAreaElement) => {
        this.removeFile(this.folders[this.activeFolder].nodes, value.value);
      },
    },
  ];

  files: NamedNode[] = this.loadFilesLocalStorage();
  activeFile: number = 0;

  folders: NamedNodeMap[] = [{
    name: "Root",
    nodes: new Map(),
  }];
  activeFolder: number = 0;

  ngAfterViewInit() { }

  llm: SimpleHttpRequest = {
    url: new URL("http://127.0.0.1:11434/v1/chat/completions"),
    method: "POST",
    headers: {},
    body: {},
    params: {},
  };

  newFile(map: Map<string, NamedNode>, fileName: string) {
    if (!map.has(fileName)) {
      const newFile: NamedNode = {
        name: fileName,
        content: "",
        tags: [],
      };
      map.set(fileName, newFile);
      console.log("New file created:", newFile);
    }
  }

  removeFile(map: Map<string, NamedNode>, fileName: string) {
    if (map.has(fileName)) {
      map.delete(fileName);
      console.log("File removed:", fileName);
    }
  }

  openFile(map: Map<string, NamedNode>, fileName: string): boolean {
    const file = map.get(fileName);
    if (file !== undefined) {
      const copy = this.deepCopy(file);
      this.files.push(copy);
      return true;
    } else {
      return false
    }
  }

  editFile(fileName: string): boolean {
    const openFileIndex = this.files.findIndex((file) => file.name === fileName);
    if (openFileIndex !== -1) {
      this.activeFile = openFileIndex;
      return true;
    } else {
      return false;
    }
  }

  closeFile(index: number) {
    this.files.splice(index, 1);
  }

  saveFile(map: Map<string, NamedNode>, file: NamedNode) {
    if (!map.has(file.name)) {
      map.set(file.name, file);
    } else {
      const existingFile = map.get(file.name);
      if (existingFile !== undefined) {
        existingFile.content = file.content;
        existingFile.tags = file.tags;
      }
    }
  }

  deepCopy<A>(obj: A): A {
    return JSON.parse(JSON.stringify(obj));
  }

  saveFilesLocalStorage(files: NamedNode[]) {
    localStorage.setItem("files", JSON.stringify(files));
  }
  
  loadFilesLocalStorage(): NamedNode[] {
    const files = localStorage.getItem("files");
    return files !== null ? JSON.parse(files) : [];
  }

  onToken(token: string | void) {
    if (this.activeFile !== -1 && token !== undefined) {
      this.files[this.activeFile].content += token;
    } else if (token !== undefined) {
      this.saveFilesLocalStorage(this.files);
    }
  }
}
