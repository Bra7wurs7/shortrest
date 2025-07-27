import { createSignal, Match, Show, Switch, type JSXElement } from "solid-js";

import logo from "./logo.svg";

enum AppMode {
  Settings,
  Assistant,
  Editor,
  Donate,
}

function App(): JSXElement {
  const [appMode, setAppMode] = createSignal(AppMode.Settings);
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
          <Archive />
          <Archive />
          <Archive opened="true" />
          <Archive />
        </div>
      </div>
      <input id="LEFT_INPUT"></input>
      <div id="LEFT_SIDEBAR">
        <div id="L_S_OPENFILES">
          <File />
          <File />
          <File />
          <FilelistFooter />
        </div>
        <div id="L_S_BOTTOM">
          <div id="L_S_B_ALLFILES">
            <FilelistHeader />
            <File />
            <File />
            <File />
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
          <div id="ASSISTANT_HISTORY"></div>
          <input id="ASSISTANT_PROMPT_INPUT"></input>
          <div id="ASSISTANT_TOOLBAR"></div>
        </Match>
        <Match when={appMode() === AppMode.Editor}>
          <textarea id="EDITOR_TEXTAREA"></textarea>
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
  const active: () => boolean = props.active;
  return (
    <button onclick={action()} class={"button_icon " + classes()}>
      <Show when={icon()}>
        <i class={"bx " + icon()}></i>
      </Show>
    </button>
  );
}

function Archive(props: any): JSXElement {
  const opened = () => props.opened;
  return (
    <button class="button_icon">
      <Show when={opened() === "true"}>
        <i class="bx bx-folder-open"></i>
      </Show>
      <Show when={!(opened() === "true")}>
        <i class="bx bx-folder"></i>
      </Show>
    </button>
  );
}

function File(): JSXElement {
  return (
    <button class="button_file">
      <div class="filename">Filename</div>
      <div class="tags">#Tag1 #Tag2</div>
    </button>
  );
}

export default App;
