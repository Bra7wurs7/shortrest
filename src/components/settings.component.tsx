import { JSXElement } from "solid-js";

export function SettingsComponent(): JSXElement {
  return (
    <div id="APP_MODE_WINDOW">
      <div id="SETTINGS_HEADER"></div>
      <div class="settings_category">
        <div class="category_title">
          <div class="left">
            <i class="bx bx-windows"></i>
            <div class="category_title_name">Operating System</div>
          </div>
          <div class="right"></div>
        </div>
      </div>
      <div class="settings_category">
        <div class="category_title">
          <div class="left">
            <i class="bx bx-globe"></i>
            <div class="category_title_name">Internet Browser</div>
          </div>
          <div class="right"></div>
        </div>
      </div>
      <div class="settings_category">
        <div class="category_title">
          <div class="left">
            <i class="bx bxs-business"></i>
            <div class="category_title_name">APIs</div>
          </div>
          <div class="right"></div>
        </div>
      </div>
      <div class="settings_category">
        <div class="category_title">
          <div class="left">
            <i class="bx bxs-hot"></i>
            <div class="category_title_name">shortrest</div>
          </div>
          <div class="right"></div>
        </div>
      </div>
    </div>
  );
}
