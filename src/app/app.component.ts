import { CommonModule } from "@angular/common";
import { AfterViewInit, Component, computed, signal } from "@angular/core";
import { RouterOutlet } from "@angular/router";
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
    FileListComponent
  ],
  templateUrl: "./app.component.html",
})
export class AppComponent implements AfterViewInit {
  title = "shortrest";

  public scrollIncrementDecrement = scrollIncrementDecrement;

  public system_actions: SystemAction[] = [
    {
      visibleRegex: new RegExp(".*"),
      name: "Experiment",
      description: "",
      icon: "iconoir-bonfire",
      command: "x",
      color: "fire",
      action: (value: HTMLTextAreaElement) => {
        this.foobar(this.folders[this.activeFolder].nodes, value.value);
      },
      highlighted: signal(false),
    },
    {
      visibleRegex: new RegExp(".*"),
      name: "List Files",
      description: "",
      icon: "iconoir-doc-magnifying-glass",
      command: "l",
      color: "purple",
      action: (value: HTMLTextAreaElement) => {
        this.newFile(this.folders[this.activeFolder].nodes, value.value);
      },
      highlighted: signal(false),
    },
    {
      visibleRegex: new RegExp(""),
      name: "Show File",
      description: "",
      icon: "iconoir-page",
      command: "s",
      color: "blue",
      action: (value: HTMLTextAreaElement) => {
        this.openFile(this.folders[this.activeFolder].nodes, value.value);
        this.editFile(value.value);
      },
      highlighted: signal(false),
    },
    {
      visibleRegex: new RegExp(".*"),
      name: "New File",
      description: "",
      icon: "iconoir-empty-page",
      command: "n",
      color: "green",
      action: (value: HTMLTextAreaElement) => {
        this.newFile(this.folders[this.activeFolder].nodes, value.value);
      },
      highlighted: signal(false),
    },
    {
      visibleRegex: new RegExp(""),
      name: "Edit File",
      description: "",
      icon: "iconoir-page-edit",
      command: "e",
      color: "yellow",
      action: (value: HTMLTextAreaElement) => {
        this.editFile(value.value);
      },
      highlighted: signal(false),
    },
    {
      visibleRegex: new RegExp(""),
      name: "Remove File",
      description: "",
      icon: "iconoir-bin-half",
      command: "r",
      color: "red",
      action: (value: HTMLTextAreaElement) => {
        this.removeFile(
          this.folders[this.activeFolder].nodes,
          this.files,
          value.value,
        );
      },
      highlighted: signal(false),
    },
  ];

  highlightedSystemAction = computed(() => 
    this.system_actions.find((sa) => { return sa.highlighted()})
  )

  files: NamedNode[] = this.loadFilesLocalStorage();
  activeFile: number = 0;

  folders: NamedNodeMap[] = [
    {
      name: "Root",
      nodes: new Map(),
    },
  ];
  activeFolder: number = 0;

  ngAfterViewInit() {}

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
      };
      map.set(fileName, newFile);
      console.log("New file created:", newFile);
    }
  }

  removeFile(
    map: Map<string, NamedNode>,
    array: NamedNode[],
    fileName: string,
  ) {
    if (map.has(fileName)) {
      map.delete(fileName);
      console.log("File removed:", fileName);
    }
    // Remove from files array
    const index = array.findIndex((file) => file.name === fileName);
    if (index !== -1) {
      array.splice(index, 1);
    }
    // Shift index if removed file is before active file
    if (index < this.activeFile && index !== -1) {
      this.activeFile--;
    }
    this.saveFilesLocalStorage(this.files);
  }

  openFile(map: Map<string, NamedNode>, fileName: string): boolean {
    const file = map.get(fileName);
    if (file !== undefined) {
      const copy = this.deepCopy(file);
      this.files.push(copy);
      return true;
    } else {
      return false;
    }
  }

  editFile(fileName: string): boolean {
    const openFileIndex = this.files.findIndex(
      (file) => file.name === fileName,
    );
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
      }
    }
  }

  foobar(map: Map<string, NamedNode>, value: string) {
    console.log(value);
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

  onFileActivated(index: number) {
    if (index >= 0 && index < this.files.length) {
      this.activeFile = index;
    } else {
      console.error("Invalid file index:", index);
    }
  }

  setActiveFile(index: number) {
    this.activeFile = index;
  }
}

export function scrollIncrementDecrement(
  invert: boolean,
  e: WheelEvent,
  n: number,
  step: number = 1,
  max: number = 100,
  min: number = 0,
): number {
  if (invert ? e.deltaY > 0 : e.deltaY < 0) {
    if (n - step >= min) {
      return n - step;
    }
  } else {
    if (n + step <= max) {
      return n + step;
    }
  }
  return n;
}
function Computed() {
  throw new Error("Function not implemented.");
}

