import { CommonModule } from "@angular/common";
import {
  Component,
  computed,
  ElementRef,
  EventEmitter,
  inject,
  Signal,
  signal,
  ViewChild,
  WritableSignal,
} from "@angular/core";
import { SimpleHttpRequest } from "../models/simple-http-request.model";
import { FormsModule } from "@angular/forms";
import { SystemAction } from "../models/system-action.model";
import { FilesService } from "../services/files/files.service";
import { ParseMarkdownPipe } from "../pipes/parse-markdown.pipe";
import { FilterFilesPipe } from "../pipes/filter-files.pipe";
import { HttpFetchWrapperService } from "../services/http-client-wrapper/http-fetch-wrapper.service";
import { OllamaChatBody, OllamaChatResponse } from "../models/ollama";
import { Context } from "../models/context.model";
import { PromptComponent } from "../components/prompt.component";
import { ParseNamePipe } from "../pipes/parse-name.pipe";
import { CenterTool } from "../models/center_tool";
import { RightTool } from "../models/right_tool";

@Component({
  selector: "app-root",
  standalone: true,
  templateUrl: "app.html",
  imports: [
    CommonModule,
    FormsModule,
    ParseMarkdownPipe,
    FilterFilesPipe,
    PromptComponent,
    ParseNamePipe,
  ],
})
export class AppComponent {
  @ViewChild("controlBar") control_bar!: ElementRef<HTMLInputElement>;

  protected filesService = inject(FilesService);
  protected http = inject(HttpFetchWrapperService);

  title = "shortrest";

  allArchiveNames: WritableSignal<string[]> = signal([]);

  activeArchiveName: string = "Unnamed Archive";
  activeArchiveFiles: string[] = [];

  activeFileName: string = "";
  activeFile: string | Blob = "";

  openedFileNames: string[] = [];

  editMode: boolean = true;
  readMode: boolean = false;

  highlightedFile: number = -1;

  preparingPrompts: Set<number> = new Set();
  runningPrompts: Set<number> = new Set();

  protected readonly generateDynamicContextEmitter = new EventEmitter();
  protected readonly fileChangeEmitter = new EventEmitter();

  protected system_actions: SystemAction[] = [
    {
      visibleRegex: new RegExp(""),
      name: "Open File",
      advice: "Enter filename",
      description: (s) => (s ? `Open "${s}"` : "Open a file by its filename"),
      icon: "iconoir-page",
      command: "o",
      color: "blue",
      action: (
        self: SystemAction,
        system_input: HTMLInputElement,
        selection: string | undefined,
      ) => {
        if (system_input.value == "" && !selection) {
          this.highlightSystemAction(this.system_actions, self);
          system_input.select();
        } else {
          this.editFile(selection ? selection : system_input.value);
          this.highlightedFile = -1;
        }
      },
      paramRequired: true,
    },
    {
      visibleRegex: new RegExp(".*"),
      name: "New File",
      advice: "Enter new filename",
      description: (s: string) =>
        s ? `Create "${s}", a new file` : "Create a new file from its name",
      icon: "iconoir-page-plus",
      command: "n",
      color: "green",
      action: (
        self: SystemAction,
        system_input: HTMLInputElement,
        selection: string | undefined,
      ) => {
        if (system_input.value == "" && !selection) {
          this.highlightSystemAction(this.system_actions, self);
          system_input.select();
        } else {
          this.newFile(selection ? selection : system_input.value);
          this.highlightedFile = -1;
        }
      },
      paramRequired: false,
    },
    {
      visibleRegex: new RegExp(".*"),
      name: "Add to prompt",
      advice:
        "Adds information from the named file to the right sidebar, for the AI to read",
      description: (s: string) =>
        s
          ? `Add "${s}" content to the prompt`
          : "Add the selected file's content to the prompt",
      icon: "iconoir-fire-flame",
      command: "x",
      color: "fire",
      action: (
        self: SystemAction,
        system_input: HTMLInputElement,
        selection: string | undefined,
      ) => {
        if (system_input.value === "" && !selection) {
          this.highlightSystemAction(this.system_actions, self);
          system_input.select();
        }
        this.filesService
          .getFileFromArchive(
            this.activeArchiveName,
            selection ? selection : system_input.value,
          )
          .then((file) => this.addInformation(file));
        this.highlightedFile = -1;
      },
      paramRequired: false,
    },
    {
      visibleRegex: new RegExp(".*"),
      name: "Remove File",
      advice: "Enter undesired filename",
      description: (s: string) =>
        s
          ? `Remove "${s}" from the library`
          : "Remove a file from the library by its filename",
      icon: "iconoir-bin-half",
      command: "r",
      color: "red",
      action: (
        self: SystemAction,
        system_input: HTMLInputElement,
        selection: string | undefined,
      ) => {
        if (system_input.value === "" && !selection) {
          this.highlightSystemAction(this.system_actions, self);
          system_input.select();
        } else {
          this.removeFile(selection ? selection : system_input.value);
          this.highlightedFile = -1;
        }
      },
      paramRequired: true,
    },
  ];

  center_tools: CenterTool[] = [
    {
      icon: "iconoir-code",
      active: false,
    },
    {
      icon: "iconoir-edit-pencil",
      active: true,
    },
    {
      icon: "iconoir-open-book",
      active: false,
    },
  ];

  right_tools: RightTool[] = [
    {
      name: "Default Tool",
      context_prompts: [],
      readTokens: "384",
      writeTokens: "384",
      seed: 1,
      temperature: 0.5,
      top_k: 1,
      advancedSettings: false,
    },
  ];

  active_right_tool_index: number = 0;

  highlightedSystemAction: Signal<undefined | SystemAction> = computed(
    () => this.system_actions[this.highlightedSystemActionIndex()],
  );

  highlightedSystemActionIndex = signal(-1);
  openFileSystemActionIndex = -1;

  llm: SimpleHttpRequest = {
    url: new URL("http://127.0.0.1:11434/v1/chat/completions"),
    method: "POST",
    headers: {},
    body: {},
    params: {},
  };

  constructor() {
    this.openFileSystemActionIndex = this.system_actions.findIndex(
      (sa) => sa.command === "o",
    );
    this.updateActiveArchiveFiles();
    this.loadRightTools();
    this.updateArchiveNames();
  }

  onAddRightToolClick() {
    this.right_tools.push({
      name: "New Tool",
      context_prompts: [],
      readTokens: "384",
      writeTokens: "384",
      seed: 1,
      temperature: 0.5,
      top_k: 1,
      advancedSettings: false,
    });
  }

  updateActiveArchiveFiles() {
    this.filesService
      .listFilesInArchive(this.activeArchiveName)
      .then((names) => (this.activeArchiveFiles = names))
      .catch(() => {
        this.filesService.createArchive(this.activeArchiveName);
      });
  }

  updateArchiveNames() {
    this.filesService.listArchives().then((a) => this.allArchiveNames.set(a));
  }

  setActiveArchive(archiveName: string) {
    this.activeArchiveName = archiveName;
    this.updateActiveArchiveFiles();
    this.openedFileNames = [];
    this.highlightedFile = -1;
    this.activeFileName = "";
    this.activeFile = "";
  }

  highlightSystemAction(systemActions: SystemAction[], action: SystemAction) {
    const index = systemActions.findIndex((sa) => sa === action);
    this.highlightedSystemActionIndex.set(index);
  }

  onToken(token: string) {
    this.activeFile += token;
  }

  systemActionOnClick(
    system_action: SystemAction,
    control_bar: HTMLInputElement,
    selection: string,
  ) {
    system_action.action(system_action, control_bar, selection);
  }

  systemBarOnKeyDown(e: KeyboardEvent) {
    const highlightedSystemActionIndex = this.highlightedSystemActionIndex();
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        this.iterateHighlightedFiles(-1);
        break;
      case "ArrowDown":
        e.preventDefault();
        this.iterateHighlightedFiles(1);
        break;
      case "Enter":
        if (e.ctrlKey) {
          this.buildPrompt();
        } else if (this.highlightedSystemAction()) {
          const action = this.highlightedSystemAction()!;
          action.action(
            action,
            this.control_bar.nativeElement,
            this.activeArchiveFiles[this.highlightedFile],
          );
        }
        break;
      case "Backspace":
        if (this.control_bar.nativeElement.value === "") {
          this.clearSystemBar();
        }
        break;
      case "Tab":
        e.preventDefault();
        // Iterate through system actions when Tab is pressed, regardless of shift key
        const newIndex =
          highlightedSystemActionIndex + 1 >= this.system_actions.length
            ? -1
            : highlightedSystemActionIndex + 1;
        this.highlightedSystemActionIndex.set(newIndex);
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
            this.highlightSystemAction(this.system_actions, command_action);
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
          this.buildPrompt();
        }
        break;
    }
    this.saveFile(this.activeFileName);
  }

  public iterateHighlightedFiles(steps: number) {
    const files = this.activeArchiveFiles;
    if (files !== null) {
      const foo = this.highlightedFile + steps;
      this.highlightedFile =
        foo < 0 || foo >= files.length
          ? -1
          : (this.highlightedFile + steps + files.length) % files.length;
    } else {
      // If files are null, set it to none
      this.highlightedFile = -1;
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

  closeFile(fileName: string) {
    const openedFileIndex = this.openedFileNames.findIndex(
      (f) => f === fileName,
    );
    this.openedFileNames.splice(openedFileIndex, 1);
    if (fileName === this.activeFileName) {
      this.activeFileName = "";
      this.activeFile = "";
    }
  }

  editFile(fileName: string) {
    // @TODO Add save check for current file
    this.filesService
      .getFileFromArchive(this.activeArchiveName, fileName)
      .then((fileContent) => (this.activeFile = fileContent));
    this.activeFileName = fileName;
    if (!this.openedFileNames.includes(fileName)) {
      this.openedFileNames.push(fileName);
    }
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

  clearSystemBar() {
    this.control_bar.nativeElement.value = "";
    this.highlightedFile = -1;
    this.highlightedSystemActionIndex.set(-1);
  }

  deepCopy<A>(obj: A): A {
    return JSON.parse(JSON.stringify(obj));
  }

  onBlurSystemBar() {
    this.highlightedFile = -1;
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
    this.editFile(activeArchiveFiles[index]);
  }

  public addInformation(information: string | Blob) {
    if (information instanceof Blob) {
      throw Error("Not Implemented");
    }
    this.right_tools[this.active_right_tool_index].context_prompts.push({
      collapsed: false,
      visible: false,
      type: "static",
      content: information,
      dynamic_content: "",
      automatic_dynamic: false,
    });
  }

  protected onAddContextClick() {
    this.right_tools[this.active_right_tool_index].context_prompts.push({
      collapsed: false,
      type: "static",
      content: "",
      dynamic_content: "",
      visible: true,
      automatic_dynamic: false,
    });
    this.saveRightTools();
  }

  protected onRemoveContextClick(i: number) {
    this.right_tools[this.active_right_tool_index].context_prompts.splice(i, 1);
  }

  protected saveRightTools() {
    localStorage.setItem("rightTools", JSON.stringify(this.right_tools));
  }

  protected loadRightTools() {
    const tools = localStorage.getItem("rightTools");
    if (tools) {
      this.right_tools = JSON.parse(tools);
    }
  }

  public buildPrompt(): SimpleHttpRequest {
    const activeContexts: Context[] = this.right_tools[
      this.active_right_tool_index
    ].context_prompts.filter((c) => c.visible);
    const body: OllamaChatBody = {
      model: "dolphin-mistral",
      format: "json",
      stream: true,
      max_tokens: +this.right_tools[this.active_right_tool_index].writeTokens,
      messages: [
        {
          role: "system",
          content: activeContexts
            .map((c) => {
              switch (c.type) {
                case "dynamic":
                  return c.dynamic_content;
                  break;
                case "static":
                  return c.content;
                  break;
              }
            })
            .join("\n"),
        },
        {
          role: "assistant",
          content: this.activeFile.slice(
            -this.right_tools[this.active_right_tool_index].readTokens * 4,
          ) as string,
        },
      ],
      options: {
        temperature: this.right_tools[this.active_right_tool_index].temperature,
        seed: this.right_tools[this.active_right_tool_index].seed,
        top_k: this.right_tools[this.active_right_tool_index].top_k,
      },
    };

    this.http.streamPrompt({ ...this.llm, body: body }).then((o) => {
      let promptId = 0;
      while (this.runningPrompts.has(promptId)) {
        promptId += 1;
      }
      this.runningPrompts.add(promptId);
      const sub = o?.stream.subscribe((streamFragment) => {
        const asTyped = streamFragment as unknown as OllamaChatResponse[];
        for (const fragment of asTyped) {
          this.onToken(fragment.choices[0].delta.content);
          if (fragment.choices[0].finish_reason !== null) {
            sub?.unsubscribe();
            this.saveFile(this.activeFileName);
            this.fileChangeEmitter.emit();
            this.runningPrompts.delete(promptId);
          }
        }
      });
    });

    return { ...this.llm, body: body };
  }

  addArchive(archiveName: string, input: HTMLInputElement) {
    if (archiveName === "") {
      input.select();
    } else {
      this.filesService.createArchive(archiveName);
      this.updateArchiveNames();
    }
  }
}
