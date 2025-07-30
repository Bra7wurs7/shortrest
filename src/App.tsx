import {
  Accessor,
  createComputed,
  createSignal,
  For,
  Match,
  Setter,
  Show,
  Switch,
  type JSXElement,
} from "solid-js";
import { Message } from "ollama";

enum AppMode {
  Settings,
  Assistant,
  Editor,
  Donate,
}

interface SavedFile {
  name: string;
  content: string;
}

interface File {
  name: Accessor<string>;
  setName: Setter<string>;
  content: Accessor<string>;
  setContent: Setter<string>;
}

function App(): JSXElement {
  const [appMode, setAppMode] = createSignal(AppMode.Editor);
  const [allFiles, setAllFiles]: [Accessor<SavedFile[]>, Setter<SavedFile[]>] =
    createSignal(loadArchive(""));
  const [openFiles, setOpenFiles]: [Accessor<File[]>, Setter<File[]>] =
    createSignal(loadOpenFiles(""));
  const [activeFile, setActiveFile]: [Accessor<number>, Setter<number>] =
    createSignal(0);
  const [assistantHistory, setAssistantHistory]: [
    Accessor<Message[]>,
    Setter<Message[]>,
  ] = createSignal([]);

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
      <input id="LEFT_INPUT"></input>
      <div id="LEFT_SIDEBAR">
        <div id="L_S_OPENFILES">
          <For each={openFiles()}>
            {(file: File, index: Accessor<number>) => (
              <FilelistItem
                name={file.name}
                active={activeFile() === index()}
                onclick={() => {
                  onClickOpenFile(index(), setActiveFile);
                }}
              />
            )}
          </For>
          <Show when={openFiles().length > 0}>
            <FilelistFooter />
          </Show>
        </div>
        <div id="L_S_BOTTOM">
          <div id="L_S_B_ALLFILES">
            <Show when={allFiles().length > 0}>
              <FilelistHeader />
            </Show>
            <For each={allFiles()}>
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
            value={openFiles()[activeFile()].content()}
            onChange={(e) => {
              onEditorChange(
                e,
                openFiles()[activeFile()].content,
                openFiles()[activeFile()].setContent,
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
  const name: () => boolean = () => props.name ?? "Unnamed File";
  const tags: () => boolean = () => props.tags ?? [];
  const onclick: () => () => void = () => props.onclick ?? (() => {});

  return (
    <button
      class={"button_file " + (active() ? "active" : "")}
      onclick={onclick()}
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

function loadOpenFiles(archiveName: string): File[] {
  const [name, setName] = createSignal("a");
  const [content, setContent] = createSignal("Schmoogenfooger");
  return [
    {
      name,
      setName,
      content,
      setContent,
    },
  ];
}

function onClickOpenFile(fileIndex: number, setter: Setter<number>) {
  setter(fileIndex);
}

function onClickSavedFile(
  file: SavedFile,
  accessor: Accessor<File[]>,
  setter: Setter<File[]>,
) {
  const openFiles = accessor();
  const fileIndexInOpenFiles = openFiles.findIndex(
    (f) => f.name() === file.name,
  );
  if (fileIndexInOpenFiles === -1) {
    const [name, setName]: [Accessor<string>, Setter<string>] = createSignal(
      file.name,
    );
    const [content, setContent]: [Accessor<string>, Setter<string>] =
      createSignal(file.content);
    setter([...openFiles, { name, setName, content, setContent }]);
  }
}

function onEditorChange(
  event: Event & {
    currentTarget: HTMLTextAreaElement;
    target: HTMLTextAreaElement;
  },
  accessor: Accessor<string> | undefined,
  setter: Setter<string> | undefined,
) {
  if (accessor && setter) {
    const fileContent = accessor();
    setter(event.target?.value);
  }
}

export default App;
