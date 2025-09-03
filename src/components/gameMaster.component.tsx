import { JSXElement } from "solid-js";

export function GameMaster(): JSXElement {
  return (
    <div id="APP_MODE_WINDOW">
      <div id="SETTINGS_HEADER"></div>
      <div class="settings_category">
        <div class="category_title">
          <div class="left">
            <i class="bx bx-dna"></i>
            <div class="category_title_name">Talents</div>
          </div>
          <div class="right"></div>
        </div>
      </div>
      <div class="settings_category">
        <div class="category_title">
          <div class="left">
            <i class="bx bx-accessibility"></i>
            <div class="category_title_name">Traits</div>
          </div>
          <div class="right"></div>
        </div>
      </div>
      <div class="settings_category">
        <div class="category_title">
          <div class="left">
            <i class="bx bx-pie-chart"></i>
            <div class="category_title_name">Conditions</div>
          </div>
          <div class="right"></div>
        </div>
      </div>
      <div class="settings_category">
        <div class="category_title">
          <div class="left">
            <i class="bx bx-math"></i>
            <div class="category_title_name">Actions</div>
          </div>
          <div class="right"></div>
        </div>
      </div>
      <div class="settings_category">
        <div class="category_title">
          <div class="left">
            <i class="bx bx-line-chart"></i>
            <div class="category_title_name">Intention</div>
          </div>
          <div class="right"></div>
        </div>
      </div>
      <hr></hr>
      <div class="settings_category">
        <div class="category_title">
          <div class="left">
            <i class="bx bxs-pyramid"></i>
            <div class="category_title_name">Entities</div>
          </div>
          <div class="right"></div>
        </div>
      </div>
      <div class="settings_category">
        <div class="category_title">
          <div class="left">
            <i class="bx bx-timer"></i>
            <div class="category_title_name">Encounters</div>
          </div>
          <div class="right"></div>
        </div>
      </div>
      <div class="settings_category">
        <div class="category_title">
          <div class="left">
            <i class="bx bx-time-five"></i>
            <div class="category_title_name">History</div>
          </div>
          <div class="right"></div>
        </div>
      </div>
    </div>
  );
}
