import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  inject,
  OnInit,
  Signal,
  signal,
  viewChild,
  ViewChild,
  WritableSignal,
} from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { AuthorAssistantComponent } from "../components/author-assistant.component";
import { SimpleHttpRequest } from "../models/simple-http-request.model";
import { FormsModule } from "@angular/forms";
import { SystemAction } from "../models/system-action.model";
import { FileListComponent } from "../components/file-list.component";
import { FilesService } from "../services/files/files.service";
import { ParseMarkdownPipe } from "../pipes/parse-markdown.pipe";
import { FilterFilesPipe } from "../pipes/filter-files.pipe";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    AuthorAssistantComponent,
    FormsModule,
    FileListComponent,
    ParseMarkdownPipe,
    FilterFilesPipe,
  ],
  templateUrl: "./app.component.html",
})
export class AppComponent {
  @ViewChild("rightSidebar") rightSidebar!: AuthorAssistantComponent;
  @ViewChild("controlBar") control_bar!: ElementRef<HTMLInputElement>;

  filesService = inject(FilesService);

  title = "shortrest";

  activeArchiveName: string = "Unnamed Archive";
  activeArchiveFiles: string[] = [];

  activeFileName: string = "";
  activeFile: string | Blob = "";

  editMode: boolean = true;
  readMode: boolean = false;

  protected system_actions: SystemAction[] = [
    {
      visibleRegex: new RegExp(""),
      name: "Open File",
      advice: "Enter filename",
      icon: "iconoir-page",
      command: "o",
      color: "blue",
      action: (self: SystemAction, system_input: HTMLInputElement) => {
        if (system_input.value == "") {
          this.highlightSystemAction(this.system_actions, self);
          system_input.select();
        } else {
          this.openFile(system_input.value);
        }
      },
      highlighted: signal(false),
      paramRequired: true,
    },
    {
      visibleRegex: new RegExp(".*"),
      name: "New File",
      advice: "Enter new filename",
      icon: "iconoir-empty-page",
      command: "n",
      color: "green",
      action: (self: SystemAction, system_input: HTMLInputElement) => {
        this.newFile(system_input.value);
      },
      highlighted: signal(false),
      paramRequired: false,
    },
    {
      visibleRegex: new RegExp(""),
      name: "Save File",
      advice: "Enter filename to save under",
      icon: "iconoir-page-edit",
      command: "s",
      color: "yellow",
      action: (self: SystemAction, system_input: HTMLInputElement) => {
        if (system_input.value == "") {
          this.highlightSystemAction(this.system_actions, self);
          system_input.select();
        } else {
          this.saveFile(system_input.value);
        }
      },
      highlighted: signal(false),
      paramRequired: true,
    },
    {
      visibleRegex: new RegExp(""),
      name: "Remove File",
      advice: "Enter undesired filename",
      icon: "iconoir-bin-half",
      command: "r",
      color: "red",
      action: (self: SystemAction, system_input: HTMLInputElement) => {
        if (system_input.value == "") {
          this.highlightSystemAction(this.system_actions, self);
          system_input.select();
        }
        this.removeFile(system_input.value);
      },
      highlighted: signal(false),
      paramRequired: true,
    },
    {
      visibleRegex: new RegExp(".*"),
      name: "Add to prompt",
      advice:
        "Adds information from the named file to the right sidebar, for the AI to read",
      icon: "iconoir-bonfire",
      command: "x",
      color: "fire",
      action: (self: SystemAction, system_input: HTMLInputElement) => {
        this.filesService
          .getFileFromArchive(this.activeArchiveName, system_input.value)
          .then((file) => this.rightSidebar.addInformation(file));
      },
      highlighted: signal(false),
      paramRequired: false,
    },
  ];

  highlightedSystemAction = computed(() =>
    this.system_actions.find((sa) => {
      return sa.highlighted();
    }),
  );

  highlightedSystemActionIndex = computed(() =>
    this.system_actions.findIndex((sa) => {
      return sa.highlighted();
    }),
  );

  llm: SimpleHttpRequest = {
    url: new URL("http://127.0.0.1:11434/v1/chat/completions"),
    method: "POST",
    headers: {},
    body: {},
    params: {},
  };

  constructor() {
    this.updateActiveArchiveFiles();
  }

  updateActiveArchiveFiles() {
    this.filesService
      .listFilesInArchive(this.activeArchiveName)
      .then((names) => (this.activeArchiveFiles = names))
      .catch(() => {
        this.filesService.createArchive(this.activeArchiveName);
      });
  }

  /** Highlight one system action while unhighlighting all others */
  highlightSystemAction(systemActions: SystemAction[], action: SystemAction) {
    for (let sa of systemActions) {
      if (sa === action) {
        sa.highlighted.set(true);
      } else {
        sa.highlighted.set(false);
      }
    }
  }

  /**
   * Triggered whenever the right sidebar emits a string token
   * @param token the token emitted. '' marks the end of a sequence
   */
  onToken(token: string) {
    if (token === "") {
      this.saveActiveArchive();
    } else {
      this.activeFile += token;
    }
  }

  systemActionOnClick(
    system_action: SystemAction,
    control_bar: HTMLInputElement,
  ) {
    system_action.action(system_action, control_bar);
  }

  systemBarOnKeyDown(e: KeyboardEvent) {
    const action = this.highlightedSystemAction();
    const index = this.highlightedSystemActionIndex();
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        if (index !== -1) {
          const newIndex = index - 1;
          this.system_actions[index].highlighted.set(false);
          if (newIndex >= 0)
            this.system_actions[newIndex].highlighted.set(true);
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        const newIndex = index + 1;
        if (index !== -1) {
          this.system_actions[index].highlighted.set(false);
        }
        if (newIndex < this.system_actions.length) {
          this.system_actions[newIndex].highlighted.set(true);
        }
        break;
      case "Enter":
        if (e.ctrlKey) {
          this.rightSidebar.buildPrompt();
        }
        if (action) {
          action.action(action, this.control_bar.nativeElement);
          //this.control_bar.nativeElement.value = "";
        }
        break;
      case "Backspace":
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
      case " ":
        if (this.highlightedSystemAction() === undefined) {
          const command = this.control_bar.nativeElement.value.split(" ")[0];
          const command_action = this.system_actions.find(
            (sa) => sa.command === command,
          );
          if (command_action) {
            command_action.highlighted.set(true);
            this.control_bar.nativeElement.value =
              this.control_bar.nativeElement.value.replace(command + " ", "");
          }
        }
        break;
    }
  }

  textInputOnKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case "Enter":
        if (e.ctrlKey) {
          this.rightSidebar.buildPrompt();
        }
        break;
    }
  }

  async saveActiveArchive() {
    return;
  }

  newFile(fileName: string = "nameless file") {
    // @TODO Add save check for current file
    this.activeFileName = fileName;
    this.activeFile = "";
    this.saveFile(fileName);
  }

  removeFile(fileName: string) {
    this.filesService.removeFileFromArchive(this.activeArchiveName, fileName);
    this.updateActiveArchiveFiles();
  }

  openFile(fileName: string) {
    // @TODO Add save check for current file
    this.activeFileName = fileName;
    this.filesService
      .getFileFromArchive(this.activeArchiveName, fileName)
      .then((fileContent) => (this.activeFile = fileContent));
  }

  saveFile(fileName: string) {
    // @TODO add same fileName Check
    if (fileName !== "") {
      this.filesService.saveFileToArchive(
        this.activeArchiveName,
        fileName,
        this.activeFile,
      );
      this.updateActiveArchiveFiles();
    }
  }

  deepCopy<A>(obj: A): A {
    return JSON.parse(JSON.stringify(obj));
  }

  scrollIncrementDecrement(
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

  scrollIndexIncrementDecrement(
    invert: boolean,
    e: WheelEvent,
    activeArchiveFiles: string[],
  ): void {
    if (activeArchiveFiles.length === 0) return;

    let index = activeArchiveFiles.indexOf(this.activeFileName);
    if (index === -1) {
      // If current file is not in the list, set it to the first/last file
      index = invert ? activeArchiveFiles.length : -1;
    }

    if (invert ? e.deltaY > 0 : e.deltaY < 0) {
      index = index + 1 === activeArchiveFiles.length ? 0 : index + 1; // Wrap around to the beginning if we're at the end
    } else {
      index = index - 1 < 0 ? activeArchiveFiles.length - 1 : index - 1; // Wrap around to the end if we're at the beginning
    }
    this.openFile(activeArchiveFiles[index]);
  }
}
