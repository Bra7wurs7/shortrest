import { CommonModule } from "@angular/common";
import {
  Component,
  computed,
  ElementRef,
  inject,
  Signal,
  signal,
  ViewChild,
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
import { InteractiveTool } from "../models/interactive_tool";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ParseMarkdownPipe,
    FilterFilesPipe,
    PromptComponent,
    ParseNamePipe,
  ],
  // #region TEMPLATE
  template: `
    <div class="flex_row height_1 justify_strech">
      <!-- LEFT SIDEBAR -->
      <div
        class="flex_col space_between margin_r width_sibedar_width position_relative"
      >
        <div
          class="border margin_b padding pseudo_input hover_highlight_border flex_row position_relative revive_children_on_hover"
          [ngClass]="{
            highlight_border: controlBar.value,
          }"
        >
          <div
            class="flex_col border_t border_l border_color_bg3 position_absolute bg_h padding_small from_right from_bottom rounded_r rounded_bl z_index_2 collapse_but_allow_revival max_width_sidebar_width"
          >
            <div
              class="border rounded_r rounded_bl border_color_bg_s padding flex margin_b font_size_small"
            >
              Type a filename into the control bar to filter files and actions.
            </div>
            <div
              class="border bg_s rounded padding_small flex margin_b flex_col"
            >
              <div class="flex_row space_between grow">
                <span
                  >⭥ <span class="color_fg4 font_size_small">(Down/Up)</span>
                </span>
                <span>Select File</span>
              </div>
            </div>
            <div
              class="border bg_s rounded padding_small flex space_between margin_b"
            >
              <span>⭾ <span class="color_fg4 font_size_small">(Tab)</span></span
              >Select Action
            </div>
            <div class="border bg_s rounded padding_small flex space_between">
              <span
                >⮐ <span class="color_fg4 font_size_small">(Return)</span></span
              >Perform action on file
            </div>
          </div>
          @if (highlightedSystemAction()) {
            <span
              class="margin_r preserve_whitespace mono {{
                highlightedSystemAction()?.color ?? ''
              }}"
              >{{ highlightedSystemAction()?.command + " " }}</span
            >
          }
          <div class="pseudo"></div>
          <input
            #controlBar
            [placeholder]="
              highlightedFile > -1
                ? (highlightedSystemAction()?.description(
                    activeArchiveFiles[highlightedFile]
                  ) ??
                  'Do what with ' + activeArchiveFiles[highlightedFile] + '?')
                : (highlightedSystemAction()?.advice ??
                  'Type here to control shortrest')
            "
            (keydown)="systemBarOnKeyDown($event)"
            (keyup)="systemBarOnKeyUp($event)"
            (blur)="onBlurSystemBar()"
            class="mono"
          />
          @if (
            controlBar.value !== "" ||
            highlightedFile !== -1 ||
            highlightedSystemActionIndex() !== -1
          ) {
            <span
              class="icon rounded iconoir-xmark color_fg4 hover_cursor_pointer hover_color_fg"
              (click)="
                controlBar.value = '';
                highlightedFile = -1;
                highlightedSystemActionIndex.set(-1)
              "
            ></span>
          }
        </div>
        <div class="flex_col width_sibedar_width space_between grow">
          <div
            (wheel)="
              scrollIndexIncrementDecrement(true, $event, activeArchiveFiles)
            "
          >
            <div class="overflow_y_scroll flex_col grow">
              @for (
                file of activeArchiveFiles | filterFiles: controlBar.value;
                track file
              ) {
                <div
                  class="hover_cursor_pointer transition_border_width user_select_none border_color_fg4 bg_h margin_b"
                  [ngClass]="{
                    border_l_thick: activeFileName === file,
                  }"
                >
                  <div
                    class="flex_row border padding space_between align_items hover_highlight_border w-full"
                    [ngClass]="{
                      bg: activeFileName === file,
                      bg_h: activeFileName !== file,
                      highlight_border:
                        file === controlBar.value || $index === highlightedFile,
                    }"
                    (click)="
                      highlightedFile !== $index
                        ? (highlightedFile = $index)
                        : editFile(file)
                    "
                  >
                    <div
                      class="align_items bg_h text_overflow_fade overflow_hidden grow flex"
                      [ngClass]="{
                        bg: activeFileName === file,
                      }"
                    >
                      <span>
                        {{ (file | parseName).name }}
                        @for (tag of (file | parseName).tags; track tag) {
                          <span
                            class="margin_l font_size_small color_border_color"
                            >#{{ tag }}</span
                          >
                        }
                      </span>
                    </div>
                    <!-- File Extension -->
                    <div class="text-right align_items">
                      {{ (file | parseName).ext }}
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
          <div
            class="rounded_tr rounded_bl hover_bg flex_row space_between position_relative revive_children_on_hover width_sibedar_width overflow_hidden"
          >
            <div
              class="border bg_h border_color_bg_s position_absolute bg_h padding from_top rounded_t rounded_br z_index_2 collapse_but_allow_revival"
            >
              List of other archives in the indexeddb
            </div>
            <span class="border padding overflow_hidden text_overflow_fade">{{
              activeArchiveName
            }}</span>
            <div>
              <span
                class="border flex icon color_fg4 rounded_tl rounded_tr rounded_bl iconoir-archive padding hover_highlight_border hover_color_fg"
              ></span>
            </div>
          </div>
        </div>
      </div>

      <!-- CENTER AREA -->
      <div class="flex_col grow">
        <div class="flex_row space_between">
          <div class="flex_row margin_b">
            @for (
              system_action of system_actions;
              track system_action.command
            ) {
              <div
                class="padding_r"
                (mouseenter)="highlightedSystemActionIndex.set($index)"
                (mouseleave)="highlightedSystemActionIndex.set(-1)"
              >
                <div
                  class="border box_sizing_border_box w_34px_highlighted_w_150px flex_row padding hover_cursor_pointer color_fg4 overflow_hidden {{
                    system_action.color
                  }}"
                  [ngClass]="{
                    highlighted: $index === highlightedSystemActionIndex(),
                    highlight_border: $index === highlightedSystemActionIndex(),
                    color_fg: $index === highlightedSystemActionIndex(),
                  }"
                  (click)="systemActionOnClick(system_action, controlBar)"
                >
                  <span
                    class="bg_h text_overflow_fade overflow_hidden grow max_w_0_highlighted_max_w_200px opacity_0_highlighted_opacity_1"
                    [ngClass]="{
                      highlighted: $index === highlightedSystemActionIndex(),
                    }"
                  >
                    {{ system_action.name }}
                  </span>
                  <span
                    class="icon {{ system_action.icon }} {{
                      $index === highlightedSystemActionIndex()
                        ? system_action.color
                        : ''
                    }}"
                  ></span>
                </div>
              </div>
            }
          </div>
          <div class="flex_row margin_b">
            @for (openedFile of openedFileNames; track openedFile) {
              <div
                class="flex margin_r  hover_cursor_pointer user_select_none position_relative revive_children_on_hover"
              >
                <div
                  class="position_absolute padding_small from_bottom right_0 bg_h collapse_but_allow_revival flex_col"
                >
                  @for (tool of interactive_tools; track tool) {
                    <span
                      class="flex icon {{
                        tool.icon
                      }} border padding hover_highlight_border hover_cursor_pointer"
                      [ngClass]="{
                        color_fg4: !tool.active,
                        bg_s: tool.active,
                      }"
                      (click)="tool.active = !tool.active"
                    ></span>
                  }
                </div>
                <div
                  class="position_absolute border_t border_b border_l from_right rounded_r top_0 bg_h collapse_but_allow_revival flex_col padding z_index_2"
                  (click)="closeFile(openedFile)"
                >
                  <div class="icon iconoir-xmark"></div>
                </div>
                <div
                  class="border padding hover_highlight_border hover_bg_s"
                  [ngClass]="{
                    color_fg4: openedFile !== activeFileName,
                    hover_bg_s: openedFile === activeFileName,
                  }"
                  (click)="editFile(openedFile)"
                >
                  {{ openedFile }}
                </div>
              </div>
            }
            <div class="flex"></div>
          </div>
        </div>
        <div
          class="grow bg flex_row rounded_br rounded_tl overflow_hidden justify_end"
        >
          @if (editMode) {
            <textarea
              class="bg border padding_big rounded_tl vertical_align_bottom hover_highlight_border"
              [ngClass]="{
                w_50: editMode && readMode,
                rounded_br: !(editMode && readMode),
              }"
              [(ngModel)]="this.activeFile"
              (ngModelChange)="saveFile(activeFileName)"
              (keydown)="textInputOnKeyDown($event)"
            ></textarea>
          }
          @if (readMode) {
            <div
              class="w_50 bg_s rounded_br rounded_tl padding_big overflow_y_scroll"
              [ngClass]="{
                w_50: editMode && readMode,
              }"
              [innerHtml]="this.activeFile | parseMarkdown | async"
            ></div>
          }
        </div>
      </div>

      <!-- RIGHT SIDEBAR -->
      <div class="margin_l flex_col space_between">
        <div
          class="flex flex_row space_between overflow_hidden width_sibedar_width"
        >
          <div class="flex flex_row margin_b overflow_hidden">
            <div
              class="border overflow_hidden text_overflow_fade padding rounded_t margin_r hover_highlight_border color_fg4 bg hover_cursor_pointer user_select_none"
            >
              Unknown Text Type
            </div>
            <div
              class="flex border padding rounded_t hover_highlight_border hover_cursor_pointer color_fg4 hover_color_fg"
            >
              <span class="icon iconoir-plus"></span>
            </div>
          </div>
          <div
            class="flex border padding margin_b hover_highlight_border hover_cursor_pointer color_fg4 hover_color_fg"
          >
            <span class="icon iconoir-settings"></span>
          </div>
        </div>
        <div
          class="flex_col width_sibedar_width bg grow space_between overflow_hidden margin_b rounded_tr"
        >
          <div class="flex_col overflow_scroll">
            @for (prompt of context_prompts; track prompt) {
              <app-prompt
                [prompt]="prompt"
                [file]="activeFile"
                [llm]="llm"
                [index]="$index"
                (remove)="onRemoveContextClick($index)"
              ></app-prompt>
            }
            <div
              class="border_b border rounded_br rounded_bl rounded_tr padding flex_row space_between hover_highlight_border bg hover_cursor_pointer color_fg4 hover_color_fg"
              [ngClass]="{
                rounded_tl: context_prompts.length > 0,
              }"
              (click)="onAddContextClick()"
            >
              <span
                class="overflow_hidden grow text_overflow_fade bg user_select_none"
                >Provide information</span
              >
              <span class="icon iconoir-plus"></span>
            </div>
          </div>

          <div class="flex_col">
            <div class="flex_row">
              <div class="flex_row">
                <div
                  class="flex_row border padding pseudo_input hover_highlight_border bg_h grow"
                  title="The amount of new text tokens the LLM may produce before being terminated"
                >
                  <input
                    class="flex"
                    placeholder="Write Tokens"
                    [(ngModel)]="writeTokens"
                  />
                  <span
                    class="icon iconoir-data-transfer-down hover_cursor_pointer color_fg4"
                  ></span>
                </div>
                <div
                  class="flex_row border padding pseudo_input hover_highlight_border bg_h grow"
                  title="How many text tokens into the past the LLM gets to read before starting to produce a continuation."
                >
                  <input
                    class="flex"
                    placeholder="Read Tokens"
                    [(ngModel)]="readTokens"
                  />
                  <span
                    class="icon iconoir-data-transfer-up hover_cursor_pointer color_fg4"
                  ></span>
                </div>
              </div>
              <div class="flex_row">
                <div
                  class="border flex_col centered_content padding color_fg4 hover_highlight_border bg_s"
                  title="Trigger a generation request for the current dynamic contexts"
                >
                  <span
                    class="icon iconoir-reload-window hover_cursor_pointer"
                    (click)="computeContexts()"
                  ></span>
                </div>
                <div
                  class="border border_color_bg_s flex_col centered_content padding hover_highlight_border"
                  title="Automatically trigger a generation request for the current dynamic contexts when the text changes"
                  [ngClass]="{
                    color_fg1: advancedSettings,
                    color_fg4: !advancedSettings,
                    bg_s: advancedSettings,
                  }"
                  (click)="advancedSettings = !advancedSettings"
                >
                  <span
                    class="icon iconoir-settings hover_cursor_pointer"
                  ></span>
                </div>
              </div>
            </div>
            @if (advancedSettings) {
              <div class="flex_row margin_t margin_b">
                <div
                  class="flex_row border padding pseudo_input hover_highlight_border bg_h margin_r"
                  title="Seed: number that all random number generation is based on"
                >
                  <input
                    class="flex"
                    placeholder="Randomness Seed"
                    [(ngModel)]="seed"
                  />
                  <span
                    class="icon iconoir-soil-alt hover_cursor_pointer color_fg4"
                  ></span>
                </div>
                <div>
                  <div
                    class="flex_row border padding pseudo_input hover_highlight_border bg_h margin_b"
                    title="Randomness (temperature): higher settings make more probable next token options more likely"
                  >
                    <input
                      class="flex"
                      placeholder="Randomness"
                      [(ngModel)]="temperature"
                    />
                    <span
                      class="icon iconoir-dice-six hover_cursor_pointer color_fg4"
                    ></span>
                  </div>
                  <div
                    class="flex_row border padding pseudo_input hover_highlight_border bg_h"
                    title="Variety (top_k): the portion of next token options to consider at all"
                  >
                    <input
                      class="flex"
                      placeholder="Variety"
                      [(ngModel)]="top_k"
                    />
                    <span
                      class="icon iconoir-palette hover_cursor_pointer color_fg4"
                    ></span>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>

        <div class="flex_col width_sibedar_width">
          <div class="flex_row">
            <div
              class="border rounded_bl padding flex_row grow hover_cursor_pointer hover_highlight_border bg_s color_fg4 hover_color_fg overflow_hidden"
              (click)="buildPrompt()"
            >
              <span class="overflow_hidden grow text_overflow_fade bg_s"
                >Generate Text</span
              >
              <span class="icon iconoir-brain-electricity margin_r"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})

// #region SCRIPT
export class AppComponent {
  @ViewChild("controlBar") control_bar!: ElementRef<HTMLInputElement>;

  protected filesService = inject(FilesService);
  protected http = inject(HttpFetchWrapperService);

  title = "shortrest";

  activeArchiveName: string = "Unnamed Library";
  activeArchiveFiles: string[] = [];

  activeFileName: string = "";
  activeFile: string | Blob = "";

  openedFileNames: string[] = [];

  editMode: boolean = true;
  readMode: boolean = false;

  highlightedFile: number = -1;

  protected system_actions: SystemAction[] = [
    {
      visibleRegex: new RegExp(""),
      name: "Open File",
      advice: "Enter filename",
      description: (s) => (s ? `Open "${s}"` : "Open a file by its filename"),
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
      action: (self: SystemAction, system_input: HTMLInputElement) => {
        if (system_input.value == "") {
          this.highlightSystemAction(this.system_actions, self);
          system_input.select();
        } else {
          this.newFile(system_input.value);
        }
      },
      paramRequired: false,
    },
    {
      visibleRegex: new RegExp(".*"),
      name: "Edit File",
      advice: "Enter filename",
      description: (s: string) =>
        s ? `Edit "${s}"` : "Open a file for editing by its filename",
      icon: "iconoir-page-edit",
      command: "e",
      color: "yellow",
      action: (self: SystemAction, system_input: HTMLInputElement) => {
        if (system_input.value == "") {
          this.highlightSystemAction(this.system_actions, self);
          system_input.select();
        } else {
          this.editFile(system_input.value);
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
          ? `Adds "${s}" content to the prompt`
          : "Adds the selected file's content to the prompt",
      icon: "iconoir-bonfire",
      command: "x",
      color: "fire",
      action: (system_action: SystemAction, system_input: HTMLInputElement) => {
        this.filesService
          .getFileFromArchive(this.activeArchiveName, system_input.value)
          .then((file) => this.addInformation(file));
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
      action: (self: SystemAction, system_input: HTMLInputElement) => {
        if (system_input.value == "") {
          this.highlightSystemAction(this.system_actions, self);
          system_input.select();
        } else {
          this.removeFile(system_input.value);
        }
      },
      paramRequired: true,
    },
  ];

  interactive_tools: InteractiveTool[] = [
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

  highlightedSystemAction: Signal<undefined | SystemAction> = computed(
    () => this.system_actions[this.highlightedSystemActionIndex()],
  );

  highlightedSystemActionIndex = signal(-1);

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
  ) {
    system_action.action(system_action, control_bar);
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
          action.action(action, this.control_bar.nativeElement);
          //this.control_bar.nativeElement.value = "";
        }
        break;
      case "Backspace":
        if (
          this.control_bar.nativeElement.value === "" &&
          this.highlightedSystemAction()
        ) {
          this.highlightedSystemActionIndex.set(-1);
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

  openFile(fileName: string) {
    // @TODO Add save check for current file
    this.openedFileNames.push(fileName);
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

  protected context_prompts: Context[] = [];
  protected readTokens: string = "384";
  protected writeTokens: string = "128";

  protected contextReadTokens: string = "1024";
  protected contextWriteTokens: string = "256";

  protected advancedSettings: boolean = false;

  protected seed: number = 0;
  protected temperature: number = 0.5;
  protected top_k: number = 1;

  public addInformation(information: string | Blob) {
    if (information instanceof Blob) {
      throw Error("Not Implemented");
    }
    this.context_prompts.push({
      collapsed: false,
      visible: false,
      type: "static",
      content: information,
      dynamic_content: "",
      automatic_dynamic: false,
    });
  }

  protected onAddContextClick() {
    this.context_prompts.push({
      collapsed: false,
      type: "static",
      content: "",
      dynamic_content: "",
      visible: true,
      automatic_dynamic: false,
    });
    this.saveContext();
  }

  protected onRemoveContextClick(i: number) {
    this.context_prompts.splice(i, 1);
    this.saveContext();
  }

  protected saveContext() {
    localStorage.setItem("context", JSON.stringify(this.context_prompts));
  }

  protected loadContext() {
    const context = localStorage.getItem("context");
    if (context) {
      this.context_prompts = JSON.parse(context);
    }
  }

  protected computeContexts() {
    for (const context of this.context_prompts) {
    }
  }

  public buildPrompt(): SimpleHttpRequest {
    const activeContexts: Context[] = this.context_prompts.filter(
      (c) => c.visible,
    );
    const body: OllamaChatBody = {
      model: "dolphin-mistral",
      format: "json",
      stream: true,
      max_tokens: +this.writeTokens,
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
          if (fragment.choices[0].finish_reason !== null) {
            sub?.unsubscribe();
            this.saveFile(this.activeFileName);
            if (this.advancedSettings) {
              this.computeContexts();
            }
          }
        }
      });
    });

    return { ...this.llm, body: body };
  }
}
