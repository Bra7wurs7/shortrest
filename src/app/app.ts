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
import { Context, defaultContext } from "../models/context.model";
import { PromptComponent } from "../components/prompt/prompt";
import { ParseNamePipe } from "../pipes/parse-name.pipe";
import { CenterTool } from "../models/center_tool";
import { RightTool } from "../models/right_tool";
import { saveAs } from "file-saver";

@Component({
  selector: "app-root",
  templateUrl: "app.html",
  imports: [CommonModule, FormsModule, FilterFilesPipe, ParseNamePipe],
})
export class AppComponent {
  @ViewChild("controlBar") control_bar!: ElementRef<HTMLInputElement>;
  @ViewChild("contentTextarea")
  contentTextarea!: ElementRef<HTMLTextAreaElement>;

  protected filesService = inject(FilesService);
  protected http = inject(HttpFetchWrapperService);

  title = "shortrest";

  allArchiveNames: WritableSignal<string[]> = signal([]);

  activeArchiveName: string = "";
  activeArchiveFiles: string[] = [];

  openedFileNames: string[] = [];
  activeFileName: string = "";
  activeFile: string | Blob = "";
  textareaSelectionStart: number = 0;
  textareaSelectionEnd: number = 0;

  highlightedFile: WritableSignal<number> = signal(-1);

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
          this.highlightedFile.set(-1);
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
          this.highlightedFile.set(-1);
        }
      },
      paramRequired: false,
    },
    {
      visibleRegex: new RegExp(".*"),
      name: "Rename File",
      advice: "Enter old & new filename",
      description: (s: string) =>
        s
          ? `Rename "${s}" to something else`
          : "Create a new file from its name",
      icon: "iconoir-page-edit",
      command: "r",
      color: "yellow",
      action: (
        self: SystemAction,
        system_input: HTMLInputElement,
        selection: string | undefined,
      ) => {
        if (selection) {
          if (system_input.value === "") {
            this.highlightSystemAction(this.system_actions, self);
            system_input.value = `"${selection}" `;
            system_input.select();
            system_input.selectionStart = system_input.selectionEnd;
            this.highlightedFile.set(-1);
          } else {
            this.renameFile(selection, system_input.value);
          }
        } else {
          if (system_input.value === "") {
            this.highlightSystemAction(this.system_actions, self);
            system_input.select();
            system_input.selectionStart = system_input.selectionEnd;
            this.highlightedFile.set(-1);
          } else {
            const parsedRename = this.parseFileRename(system_input.value);
            this.renameFile(parsedRename.from, parsedRename.to);
          }
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
        this.highlightedFile.set(-1);
      },
      paramRequired: false,
    },
    {
      visibleRegex: new RegExp(".*"),
      name: "Delete File",
      advice: "Enter undesired filename",
      description: (s: string) =>
        s
          ? `Delete "${s}" from the library`
          : "Delete a file from the library by its filename",
      icon: "iconoir-bin-half",
      command: "d",
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
          this.highlightedFile.set(-1);
        }
      },
      paramRequired: true,
    },
  ];

  center_tools: CenterTool[] = [
    {
      icon: "iconoir-code",
      active: true,
    },
    {
      icon: "iconoir-edit-pencil",
      active: false,
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
    this.loadLastArchiveName();
    this.updateActiveArchiveFiles();
    this.loadRightTools();
    this.updateArchiveNames();
  }

  ngAfterViewInit(): void {
    console.log("aa");
    console.log(this.control_bar);
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
    });
  }

  loadLastArchiveName() {
    this.setActiveArchive(
      localStorage.getItem("lastArchiveName") ?? "Unnamed Archive",
    );
  }

  setLastArchiveName(name: string) {
    localStorage.setItem("lastArchiveName", name);
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
    this.setLastArchiveName(archiveName);
    this.updateActiveArchiveFiles();
    this.openedFileNames = [];
    this.highlightedFile.set(-1);
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
            this.activeArchiveFiles[this.highlightedFile()],
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

  textInputOnKeyUp(e: KeyboardEvent) {
    this.textareaSelectionStart =
      this.contentTextarea.nativeElement.selectionStart;
    this.textareaSelectionEnd = this.contentTextarea.nativeElement.selectionEnd;
  }

  public iterateHighlightedFiles(steps: number) {
    const files = this.activeArchiveFiles;
    if (files !== null) {
      const foo = this.highlightedFile() + steps;
      this.highlightedFile.set(
        foo < 0 || foo >= files.length
          ? -1
          : (this.highlightedFile() + steps + files.length) % files.length,
      );
    } else {
      // If files are null, set it to none
      this.highlightedFile.set(-1);
    }
  }

  async saveActiveArchive() {
    return;
  }

  async newFile(fileName: string = "nameless file") {
    const fileExists = this.activeArchiveFiles.includes(fileName);
    if (fileExists) {
      console.error(`A file named ${fileName} already exists.`);
      return;
    }
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

  parseFileRename(s: string): { from: string; to: string } {
    const match = s.match(/"(.*?)" (.*)/);
    if (!match || match.length !== 3) {
      throw new Error("Invalid input format");
    }
    return { from: match[1], to: match[2] };
  }

  async renameFile(oldFileName: string, newFileName: string) {
    console.log("AAAAAH!");
    try {
      // Check if the old file exists in the archive.
      const oldFileExists = this.activeArchiveFiles.includes(oldFileName);
      if (!oldFileExists) {
        console.error(`A file named ${oldFileName} does not exist.`);
        return;
      }

      // Check if a file with the new name already exists in the archive.
      const newFileExists = this.activeArchiveFiles.includes(newFileName);
      if (newFileExists) {
        console.error(`A file named ${newFileName} already exists.`);
        return;
      }

      // If the old file is currently active, update its name in activeFileName.
      if (this.activeFileName === oldFileName) {
        this.activeFileName = newFileName;
      }

      // Get the content of the old file from the archive.
      const fileContent = await this.filesService.getFileFromArchive(
        this.activeArchiveName,
        oldFileName,
      );

      // Save the file with the new name to the archive.
      await this.filesService.saveFileToArchive(
        this.activeArchiveName,
        newFileName,
        fileContent,
      );

      // Remove the old file from the archive.
      await this.filesService.removeFileFromArchive(
        this.activeArchiveName,
        oldFileName,
      );

      // Update the list of files in the active archive.
      this.updateActiveArchiveFiles();
    } catch (error) {
      console.error("Error renaming file:", error);
    }
  }

  clearSystemBar() {
    this.control_bar.nativeElement.value = "";
    this.highlightedFile.set(-1);
    this.highlightedSystemActionIndex.set(-1);
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

  scrollThroughArchives(
    invert: boolean,
    e: WheelEvent,
    allArchiveNames: string[],
  ): void {
    if (allArchiveNames.length === 0) return;

    let index = allArchiveNames.indexOf(this.activeArchiveName);
    if (index === -1) {
      // If current archive is not in the list, set it to the first/last archive
      index = invert ? allArchiveNames.length : -1;
    }

    if (invert ? e.deltaY > 0 : e.deltaY < 0) {
      index = index + 1 === allArchiveNames.length ? 0 : index + 1; // Wrap around to the beginning if we're at the end
    } else {
      index = index - 1 < 0 ? allArchiveNames.length - 1 : index - 1; // Wrap around to the end if we're at the beginning
    }
    this.setActiveArchive(allArchiveNames[index]);
  }

  public updateRightTools() {
    this.right_tools = this.right_tools.filter(
      (tool, index, array) =>
        tool.context_prompts.length > 0 || index === array.length - 1,
    );
    // Ensure that at least one right tool always exists and is not deleted even if it has no context prompts.
    if (
      this.right_tools.length === 0 ||
      this.right_tools[this.right_tools.length - 1].context_prompts.length > 0
    ) {
      this.right_tools.push({
        name: "New Tool",
        context_prompts: [],
        readTokens: "384",
        writeTokens: "384",
        seed: 1,
        temperature: 0.5,
        top_k: 1,
      });
    }
    this.saveRightTools();
  }

  public addInformation(information: string | Blob) {
    if (information instanceof Blob) {
      throw Error("Not Implemented");
    }
    this.right_tools[this.active_right_tool_index].context_prompts.push({
      ...defaultContext,
      content: information,
    });
  }

  protected onAddContextClick() {
    this.right_tools[this.active_right_tool_index].context_prompts.push({
      ...defaultContext,
    });
    this.updateRightTools();
  }

  protected onRemoveContextClick(i: number) {
    this.right_tools[this.active_right_tool_index].context_prompts.splice(i, 1);
    this.updateRightTools();
  }

  protected saveRightTools() {
    localStorage.setItem("rightTools", JSON.stringify(this.right_tools));
  }

  protected loadRightTools() {
    const tools = localStorage.getItem("rightTools");
    if (tools) {
      this.right_tools = JSON.parse(tools);
    }
    this.updateRightTools();
  }

  public buildPrompt(): SimpleHttpRequest {
    const activeContexts: Context[] = this.right_tools[
      this.active_right_tool_index
    ].context_prompts.filter((c) => c.visible);
    const body: OllamaChatBody = {
      model: "dolphin-mistral",
      //model: "deepseek-r1:32b",
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
                case "static":
                  return c.content;
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

    console.log(body);

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

  onClickAddArchive(archiveName: string, input: HTMLInputElement) {
    if (archiveName === "") {
      input.select();
    } else {
      this.filesService.createArchive(archiveName).then();
      this.updateArchiveNames();
    }
  }

  onClickRemoveArchive(archiveName: string) {
    this.filesService.deleteArchive(archiveName);
    this.updateArchiveNames();
  }

  onClickDownloadArchive(archiveName: string) {
    this.filesService.downloadArchive(archiveName);
  }

  onFileInputChange(event: Event) {
    this.filesService.uploadArchive(event);
  }

  onClickRemoveRightTool(index: number) {
    // Check if index is within the valid range and there are more than one tool available.
    if (
      index >= 0 &&
      index < this.right_tools.length &&
      this.right_tools.length > 1
    ) {
      // Remove the tool at the specified index.
      this.right_tools.splice(index, 1);
      // Update the right tools to maintain the array's integrity.
      this.updateRightTools();
    } else {
      console.error("Invalid index or no more tools available for removal.");
    }
  }

  onClickDownloadRightTool(index: number) {
    if (index >= 0 && index < this.right_tools.length) {
      const toolToDownload = this.right_tools[index];
      const blob = new Blob([JSON.stringify(toolToDownload, null, 2)], {
        type: "application/json",
      });
      saveAs(blob, `rightTool_${index}.json`);
    } else {
      console.error("Invalid index for downloading right tool.");
    }
  }

  onRightToolFileInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      for (const file of Array.from(target.files)) {
        if (file.type === "application/json") {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const jsonData = JSON.parse(e.target?.result as string);
              this.right_tools.push(jsonData);
              this.updateRightTools();
            } catch (error) {
              console.error("Error parsing JSON file:", error);
            }
          };
          reader.readAsText(file);
        } else {
          console.error(`Unsupported file type: ${file.type}`);
        }
      }
    }
  }
}
