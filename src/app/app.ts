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
import { FormsModule } from "@angular/forms";
import { SystemAction } from "../models/system-action.model";
import { FilesService } from "../services/files/files.service";
import { FilterFilesPipe } from "../pipes/filter-files.pipe";
import { ParseNamePipe } from "../pipes/parse-name.pipe";
import { RightSidebarItemComponent } from "../components/right-sidebar-item/right-sidebar-item.component";
import { Workflow } from "../models/workflow.model";

@Component({
  selector: "app-root",
  templateUrl: "app.html",
  imports: [
    CommonModule,
    FormsModule,
    FilterFilesPipe,
    ParseNamePipe,
    RightSidebarItemComponent,
  ],
})
export class AppComponent {
  @ViewChild("controlBar") control_bar!: ElementRef<HTMLInputElement>;
  @ViewChild("centerAreaContentTextarea")
  centerAreaContentTextarea!: ElementRef<HTMLTextAreaElement>;

  protected filesService = inject(FilesService);

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

  right_sidebar_workflows: Workflow[] = [
    {
      globalVariables: {},
      name: "",
      nodes: [
        {
          name: "",
          tool: "readFile",
          inputProperties: {},
          outputProperties: {},
        },
        {
          name: "",
          tool: "constructMessage",
          inputProperties: {},
          outputProperties: {},
        },
        {
          name: "",
          tool: "streamChatApi",
          inputProperties: {},
          outputProperties: {},
        },
        {
          name: "",
          tool: "writeStreamToFile",
          inputProperties: {},
          outputProperties: {},
        },
      ],
    },
    {
      globalVariables: {},
      name: "",
      nodes: [
        {
          name: "",
          tool: "constructMessage",
          inputProperties: {},
          outputProperties: {},
        },
        {
          name: "",
          tool: "constructMessage",
          inputProperties: {},
          outputProperties: {},
        },
      ],
    },
  ];
  active_workflow: WritableSignal<number> = signal(0);

  protected readonly generateDynamicContextEmitter = new EventEmitter();
  protected readonly fileChangeEmitter = new EventEmitter();

  protected system_actions: SystemAction[] = [
    {
      visibleRegex: new RegExp(""),
      name: "Open File",
      advice: "Enter filename",
      description: (s) => (s ? `Open "${s}"` : "Open a file by its filename"),
      icon: "bx bx-file",
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
      icon: "bx bx-file-blank",
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
      icon: "bx bx-edit",
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
      icon: "bx bxs-hot",
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
      icon: "bx bx-trash-alt",
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

  active_right_tool_index: number = 0;

  highlightedSystemAction: Signal<undefined | SystemAction> = computed(
    () => this.system_actions[this.highlightedSystemActionIndex()],
  );

  highlightedSystemActionIndex = signal(-1);
  openFileSystemActionIndex = -1;

  constructor() {
    this.openFileSystemActionIndex = this.system_actions.findIndex(
      (sa) => sa.command === "o",
    );
    this.loadLastArchiveName();
    this.updateActiveArchiveFiles();
    //this.loadRightTools();
    this.updateArchiveNames();
  }

  ngAfterViewInit(): void {
    console.log("aa");
    console.log(this.control_bar);
  }

  onAddRightToolClick() {
    throw new Error("NotImplemented");
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
      this.centerAreaContentTextarea.nativeElement.selectionStart;
    this.textareaSelectionEnd =
      this.centerAreaContentTextarea.nativeElement.selectionEnd;
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
    throw new Error("NotImplemented");
  }

  public addInformation(information: string | Blob) {
    throw new Error("NotImplemented");
  }

  protected onAddContextClick() {
    throw new Error("NotImplemented");
  }

  protected onRemoveContextClick(i: number) {
    throw new Error("NotImplemented");
  }

  protected saveRightTools() {
    throw new Error("NotImplemented");
  }

  protected loadRightTools() {
    throw new Error("NotImplemented");
  }

  public buildPrompt(): unknown {
    throw new Error("NotImplemented");
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
    throw new Error("NotImplemented");
  }

  onClickDownloadRightTool(index: number) {
    throw new Error("NotImplemented");
  }

  onRightToolFileInputChange(event: Event) {
    throw new Error("NotImplemented");
  }

  validateWorkflow(workflow: Workflow) {
    /*
    1. Init global variables
    2. Init nodes
    3.
    */
  }

  runWorkflow(workflow: Workflow) {
    /*
    1. Load global variables for workflow
    2. Load nodes from workflow
    3. prepare requested inputs for each node
    4. if nodes have misconfigured inputs, highlight them in red
    5. else, for each node:
      1. call node.run(nodeinputs) and store the result
      2. update inputs based on the result
      3. execute functions requested by the node
    */
  }
}
