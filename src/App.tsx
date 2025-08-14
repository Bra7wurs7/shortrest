import {
  Accessor,
  createComputed,
  createMemo,
  createSignal,
  For,
  Match,
  Setter,
  Show,
  Switch,
  type JSXElement,
} from "solid-js";
import { Message } from "ollama";
import { parseFile } from "./parsers/parseFile.function";
import { AppMode } from "./types/appMode.interface";
import { SavedFile } from "./types/savedFile.interface";
import { OpenFile } from "./types/openFile.interface";
import { DOMElement } from "solid-js/jsx-runtime";

const localStorageOpenFilesKey = "openFiles";

function App(): JSXElement {
  const [appMode, setAppMode] = createSignal<AppMode>(AppMode.Editor);
  const [allFiles, setAllFiles] = createSignal<SavedFile[]>(loadArchive(""));
  const [openFiles, setOpenFiles] = createSignal<OpenFile[]>(loadOpenFiles());
  const [activeFile, setActiveFile] = createSignal<number>(0);
  const [inputValue, setInputValue] = createSignal<string>("");
  const [rightClickedFile, setRightClickedFile] = createSignal<string>("");
  const filteredOpenFiles = createMemo<OpenFile[]>(() => {
    return openFiles().filter((of) =>
      of.name().toLowerCase().includes(inputValue().toLowerCase()),
    );
  });
  const filteredAllFiles = createMemo<SavedFile[]>(() => {
    return allFiles().filter((af) =>
      af.name.toLowerCase().includes(inputValue().toLowerCase()),
    );
  });
  const [assistantHistory, setAssistantHistory] = createSignal<Message[]>([]);

  return (
    <div id="APP_CONTAINER" class="dark_theme">
      <div id="LEFTMOST_SIDEBAR">
        <div id="LM_S_ACTIONS">
          <Button
            icon="bx-cog"
            action={() => {
              setAppMode(AppMode.Settings);
            }}
            active={appMode() === AppMode.Settings}
          />
          <Button
            icon="bx-conversation"
            action={() => {
              setAppMode(AppMode.Assistant);
            }}
            active={appMode() === AppMode.Assistant}
          />
          <Button
            icon="bx-file"
            action={() => {
              setAppMode(AppMode.Editor);
            }}
            active={appMode() === AppMode.Editor}
          />
          <Button
            icon="bx-donate-heart"
            action={() => {
              setAppMode(AppMode.Donate);
            }}
            active={appMode() === AppMode.Donate}
          />
        </div>
        <div id="LM_S_ARCHIVES">
          <Archive />
          <Archive opened={true} />
          <Archive />
        </div>
      </div>
      <input
        id="LEFT_INPUT"
        value={inputValue()}
        onkeyup={(e) => {
          onInputKeyUp(
            e,
            setInputValue,
            openFiles,
            filteredOpenFiles,
            setOpenFiles,
            filteredAllFiles,
            setActiveFile,
          );
        }}
      ></input>
      <div id="LEFT_SIDEBAR">
        <div id="L_S_OPENFILES">
          <For each={filteredOpenFiles()}>
            {(file: OpenFile, index: Accessor<number>) => (
              <FilelistItem
                name={file.name}
                active={activeFile() === index()}
                onclick={() => {
                  onClickOpenFile(index(), setActiveFile);
                }}
              />
            )}
          </For>
          <Show when={filteredOpenFiles().length > 0}>
            <FilelistFooter />
          </Show>
        </div>
        <div id="L_S_BOTTOM">
          <div id="L_S_B_ALLFILES">
            <Show when={filteredAllFiles().length > 0}>
              <FilelistHeader />
            </Show>
            <For each={filteredAllFiles()}>
              {(file: SavedFile) => (
                <FilelistItem
                  name={file.name}
                  onclick={() => {
                    onClickSavedFile(file, openFiles, setOpenFiles);
                  }}
                />
              )}
            </For>
          </div>
          <div id="L_S_B_TOOLTIP"></div>
        </div>
      </div>
      <Switch>
        <Match when={appMode() === AppMode.Settings}>
          <div id="SETTINGS_WINDOW"></div>
          <div id="SETTINGS_CATEGORIES"></div>
        </Match>
        <Match when={appMode() === AppMode.Assistant}>
          <div id="ASSISTANT_HISTORY">
            <div class="message system">
              You are a philosopher and a great mind. You also give excellent
              financial advice.
            </div>
            <div class="message ours">
              Hey AI! How's it going? I've got some spare money that I wanna
              multiply. Do you think it would be smart to invest in Microsoft?
            </div>
            <div class="message theirs">
              Only if you wanna strengthen an already too powerful and
              apparently evil monopoly my bro!
            </div>
          </div>
          <input id="ASSISTANT_PROMPT_INPUT"></input>
          <div id="ASSISTANT_TOOLBAR"></div>
        </Match>
        <Match when={appMode() === AppMode.Editor}>
          <textarea
            id="EDITOR_TEXTAREA"
            value={openFiles()[activeFile()]?.content() ?? ""}
            onChange={(e) => {
              onEditorChange(
                e,
                openFiles()[activeFile()].content,
                openFiles()[activeFile()].setContent,
                openFiles,
              );
            }}
          ></textarea>
          <div id="EDITOR_TOOLBAR"></div>
        </Match>
        <Match when={appMode() === AppMode.Donate}>
          <div id="DONATE_MESSAGE"></div>
        </Match>
      </Switch>
    </div>
  );
}

function FilelistHeader(): JSXElement {
  return (
    <div class="filelist_header">
      <span></span>
      <span>Saved Files</span>
    </div>
  );
}

function FilelistFooter(): JSXElement {
  return (
    <div class="filelist_footer">
      <span></span>
      <span>Open Files</span>
    </div>
  );
}

function Button(props: any): JSXElement {
  const icon: () => string = () => props.icon;
  const classes: () => string = () => props.classes ?? "";
  const action: () => () => void = () => props.action ?? (() => {});
  const active: () => boolean = () => props.active ?? false;
  return (
    <button
      onclick={action()}
      class={"button_icon " + classes() + (active() ? "active" : "")}
    >
      <Show when={icon()}>
        <i class={"bx " + icon()}></i>
      </Show>
    </button>
  );
}

function Archive(props: any): JSXElement {
  const opened: () => boolean = () => props.opened;

  return (
    <button class={"button_icon " + (opened() ? "active" : "")}>
      <Show when={opened() === true}>
        <i class="bx bx-folder-open"></i>
      </Show>
      <Show when={!(opened() === true)}>
        <i class="bx bx-folder"></i>
      </Show>
    </button>
  );
}

function FilelistItem(props: any): JSXElement {
  const active: () => boolean = () => props.active ?? false;
  const name: () => string = () => props.name ?? "Unnamed File";
  const tags: () => string = () => props.tags ?? [];
  const onclick: () => () => void = () => props.onclick ?? (() => {});
  const draggable: () => boolean = () => props.draggable ?? false;
  const rightclickedItemSetter: () => Setter<string> | undefined = () =>
    props.setter;
  const ondragstart: () => (
    e: DragEvent & {
      currentTarget: HTMLButtonElement;
      target: DOMElement;
    },
  ) => void = () => props.ondragstart ?? (() => {});
  const ondragend: () => (
    e: DragEvent & {
      currentTarget: HTMLButtonElement;
      target: DOMElement;
    },
  ) => void = () => props.ondragend ?? (() => {});
  const ondrop: () => (
    e: DragEvent & {
      currentTarget: HTMLButtonElement;
      target: DOMElement;
    },
  ) => void = () => props.ondrop ?? (() => {});

  return (
    <button
      class={"button_file " + (active() ? "active" : "")}
      onclick={onclick()}
      oncontextmenu={(e: PointerEvent) =>
        onComponentRightclick(e, name(), rightclickedItemSetter())
      }
      draggable={true}
      ondragstart={(e) => {
        e.dataTransfer?.setData("text/plain", (name() as any)());
        console.log(e);
      }}
      ondragover={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        console.log(e.dataTransfer?.getData("text/plain"));
      }}
    >
      <div class="filename">{name()}</div>
      <div class="tags">#Tag1 #Tag2</div>
    </button>
  );
}

function prettyStringify(a: any) {
  JSON.stringify(a, null, 2);
}

function loadArchive(name: string): SavedFile[] {
  return [
    {
      name: "a",
      content: "Foo",
    },
    {
      name: "b",
      content: "",
    },
    {
      name: "c",
      content: "Aaaaaaas",
    },
  ];
}

/**
 *
 * @returns
 */
function loadOpenFiles(): OpenFile[] {
  const storedOpenFiles = localStorage.getItem(localStorageOpenFilesKey);
  if (storedOpenFiles) {
    const parsed = parseFile(storedOpenFiles);
    if (typeof parsed === "string") {
      console.log(parsed);
    } else {
      return parsed;
    }
  }
  return [];
}

/**
 * Persists the values of the provided array in localstorage
 * @param files The File array to store in the localstorage
 */
function storeOpenFiles(files: Accessor<OpenFile[]>) {
  const serializedFiles = files().map((file) => ({
    name: file.name(),
    content: file.content(),
  }));
  localStorage.setItem(
    localStorageOpenFilesKey,
    JSON.stringify(serializedFiles),
  );
}

function onClickOpenFile(fileIndex: number, setter: Setter<number>) {
  setter(fileIndex);
}

function onClickSavedFile(
  file: SavedFile,
  accessor: Accessor<OpenFile[]>,
  setter: Setter<OpenFile[]>,
) {
  const openFiles = accessor();
  const fileIndexInOpenFiles = openFiles.findIndex(
    (f) => f.name() === file.name,
  );
  if (fileIndexInOpenFiles === -1) {
    const [name, setName] = createSignal<string>(file.name);
    const [content, setContent] = createSignal<string>(file.content);
    setter([...openFiles, { name, setName, content, setContent }]);
    storeOpenFiles(accessor);
  }
}

function onEditorChange(
  event: Event & {
    currentTarget: HTMLTextAreaElement;
    target: HTMLTextAreaElement;
  },
  accessor: Accessor<string> | undefined,
  setter: Setter<string> | undefined,
  openFiles: Accessor<OpenFile[]>,
) {
  if (accessor && setter) {
    const fileContent = accessor();
    setter(event.target?.value);
    storeOpenFiles(openFiles);
  }
}

function onComponentRightclick(
  e: PointerEvent,
  name: string,
  setter: Setter<string> | undefined,
) {
  e.preventDefault();
  if (setter) setter(name);
}

function onInputKeyUp(
  e: KeyboardEvent & { currentTarget: HTMLInputElement; target: Element },
  inputSetter: Setter<string>,
  openFilesAccessor: Accessor<OpenFile[]>,
  filteredOpenFilesAccessor: Accessor<OpenFile[]>,
  openFilesSetter: Setter<OpenFile[]>,
  filteredSavedFilesAccessor: Accessor<SavedFile[]>,
  activeFileSetter: Setter<number>,
) {
  inputSetter(e.currentTarget.value);
  switch (e.key) {
    case "Enter":
      if (e.ctrlKey) {
        const [name, setName] = createSignal<string>(e.currentTarget.value);
        const [content, setContent] = createSignal<string>("");
        openFilesSetter([
          ...openFilesAccessor(),
          { name, setName, content, setContent },
        ]);
        activeFileSetter(openFilesAccessor().length - 1);
        inputSetter("");
        storeOpenFiles(openFilesAccessor);
      } else {
        if ((filteredOpenFilesAccessor().length = 1)) {
          activeFileSetter(
            openFilesAccessor().findIndex(
              (of) => of.name === filteredOpenFilesAccessor()[0].name,
            ),
          );
          inputSetter("");
        } else if (
          (filteredSavedFilesAccessor().length =
            1 && (filteredOpenFilesAccessor().length = 0))
        ) {
          const savedFile = filteredSavedFilesAccessor()[0];
          const [name, setName] = createSignal<string>(savedFile.name);
          const [content, setContent] = createSignal<string>(savedFile.content);
          openFilesSetter([
            ...openFilesAccessor(),
            { name, setName, content, setContent },
          ]);
        }
      }
      break;
    default:
      break;
  }
}

export default App;
