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
import { SimpleHttpRequest } from "../models/simple-http-request.model";
import { FormsModule } from "@angular/forms";
import { SystemAction } from "../models/system-action.model";
import { FileListComponent } from "../components/file-list.component";
import { FilesService } from "../services/files/files.service";
import { ParseMarkdownPipe } from "../pipes/parse-markdown.pipe";
import { FilterFilesPipe } from "../pipes/filter-files.pipe";
import { HttpFetchWrapperService } from "../services/http-client-wrapper/http-fetch-wrapper.service";
import { OllamaChatBody, OllamaChatResponse } from "../models/ollama";
import { Context } from "../models/context.model";
import { PromptComponent } from "../components/prompt.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    FormsModule,
    FileListComponent,
    ParseMarkdownPipe,
    FilterFilesPipe,
    PromptComponent
  ],
  templateUrl: "./app.component.html",
})
export class AppComponent {
  @ViewChild("fileList") fileList!: FileListComponent;
  @ViewChild("controlBar") control_bar!: ElementRef<HTMLInputElement>;

  filesService = inject(FilesService);
  protected http = inject(HttpFetchWrapperService);

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
          .then((file) => this.addInformation(file));
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
    this.loadContext();
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
    const highlightedSystemAction = this.highlightedSystemAction();
    const highlightedSystemActionIndex = this.highlightedSystemActionIndex();
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        if (highlightedSystemActionIndex !== -1) {
          const newIndex = highlightedSystemActionIndex - 1;
          this.system_actions[highlightedSystemActionIndex].highlighted.set(
            false,
          );
          if (newIndex >= 0)
            this.system_actions[newIndex].highlighted.set(true);
        } else {
          this.fileList.iterateHighlightedFiles();
        }

        break;
      case "ArrowDown":
        e.preventDefault();
        const newIndex = highlightedSystemActionIndex + 1;
        if (highlightedSystemActionIndex !== -1) {
          this.system_actions[highlightedSystemActionIndex].highlighted.set(
            false,
          );
        }
        if (newIndex < this.system_actions.length) {
          this.system_actions[newIndex].highlighted.set(true);
        }
        break;
      case "Enter":
        if (e.ctrlKey) {
          this.buildPrompt();
        }
        if (highlightedSystemAction) {
          highlightedSystemAction.action(
            highlightedSystemAction,
            this.control_bar.nativeElement,
          );
          //this.control_bar.nativeElement.value = "";
        }
        break;
      case "Backspace":
        if (
          this.control_bar.nativeElement.value === "" &&
          highlightedSystemAction
        ) {
          highlightedSystemAction.highlighted.set(false);
        }
        break;
      case "Tab":
        this.fileList.iterateHighlightedFiles();
        e.preventDefault();
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
          this.buildPrompt();
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

  onBlurSystemBar() {
    this.fileList.resetHighlightedFile();
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

  protected context_prompts: Context[] = [];
  protected readTokens: string = '384';
  protected writeTokens: string = '128';

  protected contextReadTokens: string = '1024';
  protected contextWriteTokens: string = '256';

  protected advancedSettings: boolean = false;

  protected seed: number = 0;
  protected temperature: number = 0.5;
  protected top_k: number = 1;

  public addInformation(information: string | Blob) {
    if (information instanceof Blob) {
      throw Error('Not Implemented');
    }
    this.context_prompts.push({
      collapsed: false,
      visible: false,
      type: 'static',
      content: information,
      dynamic_content: '',
    });
  }

  protected onAddContextClick() {
    this.context_prompts.push({
      collapsed: false,
      type: 'static',
      content: '',
      dynamic_content: '',
      visible: true,
    });
    this.saveContext();
  }

  protected onRemoveContextClick(i: number) {
    this.context_prompts.splice(i, 1);
    this.saveContext();
  }

  protected saveContext() {
    localStorage.setItem('context', JSON.stringify(this.context_prompts));
  }

  protected loadContext() {
    const context = localStorage.getItem('context');
    if (context) {
      this.context_prompts = JSON.parse(context);
    }
  }

  protected computeContexts() {
    for (const context of this.context_prompts) {
      switch (context.type) {
        case 'dynamic':
          //this.computeDynamicContext(context);
          break;
        case 'static':
          break;
      }
    }
  }

  public buildPrompt(): SimpleHttpRequest {
    const activeContexts: Context[] = this.context_prompts.filter(
      (c) => c.visible
    );
    const body: OllamaChatBody = {
      model: 'dolphin-mistral',
      format: 'json',
      stream: true,
      max_tokens: +this.writeTokens,
      messages: [
        {
          role: 'system',
          content: activeContexts
            .map((c) => {
              switch (c.type) {
                case 'dynamic':
                  return c.dynamic_content;
                  break;
                case 'static':
                  return c.content;
                  break;
              }
            })
            .join('\n'),
        },
        {
          role: 'assistant',
          content: this.activeFile.slice(-this.readTokens * 4) as string,
        },
      ],
      options: {
        temperature: this.temperature,
        seed: this.seed,
        top_k: this.top_k,
      },
    };

    this.http.streamPrompt({ ...this.llm, body: body }).then((o) => {
      const sub = o?.subscribe((streamFragment) => {
        const asTyped = streamFragment as unknown as OllamaChatResponse[];
        for (const fragment of asTyped) {
          this.onToken(fragment.choices[0].delta.content);
          if (fragment.done) {
            sub?.unsubscribe();
            this.computeContexts();
            this.saveActiveArchive();
            if (this.advancedSettings) {
              this.onClickReloadDynamicContexts();
            }
          }
        }
      });
    });

    return { ...this.llm, body: body };
  }

  protected onClickReloadDynamicContexts() {
    for (const context of this.context_prompts) {
      if (context.type === 'dynamic') {
        //this.computeDynamicContext(context);
      }
    }
  }
}
