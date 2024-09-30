import { CommonModule } from "@angular/common";
import { AfterViewInit, Component, computed, ElementRef, signal, ViewChild } from "@angular/core";
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

  @ViewChild('controlBar') control_bar!: ElementRef<HTMLInputElement>;

  public scrollIncrementDecrement = scrollIncrementDecrement;

  public system_actions: SystemAction[] = [
    {
      visibleRegex: new RegExp(".*"),
      name: "Experiment",
      advice: "Let the AI enjoy some rest, allowing it to do what it wants",
      icon: "iconoir-bonfire",
      command: "x",
      color: "fire",
      action: (value: HTMLInputElement) => {
        this.foobar(this.folders[this.activeFolder].nodes, value.value);
      },
      highlighted: signal(false),
    },
    {
      visibleRegex: new RegExp(".*"),
      name: "List Files",
      advice: "Optinally add filters like file names or tabs",
      icon: "iconoir-doc-magnifying-glass",
      command: "l",
      color: "purple",
      action: (value: HTMLInputElement) => {
        this.newFile(this.folders[this.activeFolder].nodes, value.value);
      },
      highlighted: signal(false),
    },
    {
      visibleRegex: new RegExp(""),
      name: "Show File",
      advice: "Enter the name of the file to show",
      icon: "iconoir-page",
      command: "s",
      color: "blue",
      action: (value: HTMLInputElement) => {
        this.openFile(this.folders[this.activeFolder].nodes, value.value);
        this.editFile(value.value);
      },
      highlighted: signal(false),
    },
    {
      visibleRegex: new RegExp(".*"),
      name: "New File",
      advice: "Enter a name for the new file",
      icon: "iconoir-empty-page",
      command: "n",
      color: "green",
      action: (value: HTMLInputElement) => {
        this.newFile(this.folders[this.activeFolder].nodes, value.value);
        this.openFile(this.folders[this.activeFolder].nodes, value.value);
        this.editFile(value.value);
      },
      highlighted: signal(false),
    },
    {
      visibleRegex: new RegExp(""),
      name: "Edit File",
      advice: "Enter the name of the file to edit",
      icon: "iconoir-page-edit",
      command: "e",
      color: "yellow",
      action: (value: HTMLInputElement) => {
        this.editFile(value.value);
      },
      highlighted: signal(false),
    },
    {
      visibleRegex: new RegExp(""),
      name: "Remove File",
      advice: "Enter the name of the file you want to delete",
      icon: "iconoir-bin-half",
      command: "r",
      color: "red",
      action: (value: HTMLInputElement) => {
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
    this.system_actions.find((sa) => { return sa.highlighted() })
  );

  highlightedSystemActionIndex = computed(() =>
    this.system_actions.findIndex((sa) => { return sa.highlighted() })
  );

  files: NamedNode[] = this.loadFilesLocalStorage();
  activeFile: number = 0;

  folders: NamedNodeMap[] = [
    {
      name: "Root",
      nodes: new Map(),
    },
  ];
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

  systemActionOnClick(system_action: SystemAction, control_bar: HTMLInputElement) {
    system_action.action(control_bar);
  }

  systemBarOnKeyDown(e: KeyboardEvent) {
    const action = this.highlightedSystemAction();
    const index = this.highlightedSystemActionIndex();
    switch (e.key) {
      case ("ArrowUp"):
        e.preventDefault();
        if (index === -1) {
          this.system_actions[this.system_actions.length - 1].highlighted.set(true);
        } else {
          const newIndex = index - 1;
          this.system_actions[index].highlighted.set(false);
          if (newIndex >= 0)
            this.system_actions[newIndex].highlighted.set(true);
        }
        break;
      case ("ArrowDown"):
        e.preventDefault();
        if (index !== -1) {
          const newIndex = index + 1;
          this.system_actions[index].highlighted.set(false);
          if (newIndex < this.system_actions.length)
            this.system_actions[newIndex].highlighted.set(true);
        }
        break;
      case ("Enter"):
        if (action) {
          action.action(this.control_bar.nativeElement)
          //this.control_bar.nativeElement.value = "";
        }
        break;
      case ("Backspace"):
        if (this.control_bar.nativeElement.value === "" && action) {
          action.highlighted.set(false);
        }
        break;

    }
  }

  systemBarOnKeyUp(e: KeyboardEvent) {
    const action = this.highlightedSystemAction();
    const index = this.highlightedSystemActionIndex();
    switch (e.key) {
      case (" "):
        if (this.highlightedSystemAction() === undefined) {
          const command = this.control_bar.nativeElement.value.split(" ")[0];
          const command_action = this.system_actions.find((sa) => sa.command === command);
          if (command_action) {
            command_action.highlighted.set(true);
            this.control_bar.nativeElement.value = this.control_bar.nativeElement.value.replace(command + " ", "");
          }
        }
        break;
    }
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