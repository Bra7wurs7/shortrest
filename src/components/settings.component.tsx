import { JSXElement } from "solid-js";

export function SettingsComponent(): JSXElement {
  return (
    <div id="SETTINGS_WINDOW">
      <div id="SETTINGS_HEADER">a</div>
      <div class="settings_category">
        <div class="category_title">
          <i class="bx bxs-brain"></i>
          <div class="category_title_name">LLM Providers</div>
        </div>
      </div>
    </div>
  );
}
