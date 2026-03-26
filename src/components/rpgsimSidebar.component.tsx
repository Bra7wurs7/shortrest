import "./rpgsimSidebar.component.css";
import { Accessor, createSignal, For, Index, JSXElement, Show } from "solid-js";
import { RPGSimState, PlutchikEmotions } from "../types/rpgsim.interface";
import type { UseRPGSimReturn } from "../hooks/useRPGSimState";

const EMOTION_KEYS: (keyof PlutchikEmotions)[] = [
  "joy",
  "trust",
  "fear",
  "surprise",
  "sadness",
  "disgust",
  "anger",
  "anticipation",
];

const EMOTION_LABELS: Record<keyof PlutchikEmotions, string> = {
  joy: "Joy",
  trust: "Trust",
  fear: "Fear",
  surprise: "Surprise",
  sadness: "Sadness",
  disgust: "Disgust",
  anger: "Anger",
  anticipation: "Anticipation",
};

export interface RPGSimSidebarProps {
  rpgSim: UseRPGSimReturn;
  onNextRound: () => void;
}

export function RPGSimSidebar(props: RPGSimSidebarProps): JSXElement {
  const state: Accessor<RPGSimState> = () => props.rpgSim.state();

  // Local input signals for add forms
  const [newCharName, setNewCharName] = createSignal("");
  const [newItemName, setNewItemName] = createSignal("");

  function handleAddCharacter() {
    const name = newCharName().trim();
    if (!name) return;
    props.rpgSim.addCharacter(name);
    setNewCharName("");
  }

  function handleAddItem() {
    const name = newItemName().trim();
    if (!name) return;
    props.rpgSim.addItem(name);
    setNewItemName("");
  }

  return (
    <div id="RPGSIM_SIDEBAR">
      <div class="rpgsim_top">
        {/* ── Scene ──────────────────────────────────────────── */}
        <div class="rpgsim_section">
          <div class="rpgsim_section_header">
            <div class="left">
              <i class="bx bx-landscape" />
              <span>Scene</span>
            </div>
          </div>
          <div class="rpgsim_section_body">
            <textarea
              class="rpgsim_scene_textarea"
              placeholder="Describe the scene..."
              value={state().scene.description}
              onInput={(e) =>
                props.rpgSim.setSceneDescription(e.currentTarget.value)
              }
            />
          </div>
        </div>

        {/* ── Characters ────────────────────────────────────── */}
        <div class="rpgsim_section">
          <div class="rpgsim_section_header">
            <div class="left">
              <i class="bx bx-group" />
              <span>Characters</span>
            </div>
            <div class="right">
              <span style={{ "font-family": "var(--mono)", "font-size": "0.8em" }}>
                {state().scene.characters.length}
              </span>
            </div>
          </div>
          <div class="rpgsim_section_body">
            <Index each={state().scene.characters}>
              {(char) => {
                const isActive = () =>
                  state().activeCharacterId === char().id;
                const isCollapsed = () => char().collapsed;

                // Local signals for inline add inputs
                const [newThought, setNewThought] = createSignal("");
                const [newAction, setNewAction] = createSignal("");
                const [newMemory, setNewMemory] = createSignal("");

                return (
                  <div class="rpgsim_character">
                    <div
                      class={
                        "rpgsim_character_header" +
                        (isActive() ? " active_character" : "")
                      }
                      onclick={() =>
                        props.rpgSim.updateCharacter(char().id, {
                          collapsed: !char().collapsed,
                        })
                      }
                    >
                      <div class="left">
                        <i class="bx bx-user" />
                        <span>{char().name}</span>
                      </div>
                      <div class="right">
                        <i
                          class="bx bx-eraser"
                          title="Clear character state"
                          onclick={(e) => {
                            e.stopPropagation();
                            props.rpgSim.clearCharacter(char().id);
                          }}
                        />
                        <i
                          class="bx bx-x"
                          onclick={(e) => {
                            e.stopPropagation();
                            props.rpgSim.removeCharacter(char().id);
                          }}
                        />
                      </div>
                    </div>

                    <Show when={!isCollapsed()}>
                      <div class="rpgsim_character_body">
                        {/* Name */}
                        <div class="rpgsim_char_label">Name</div>
                        <input
                          class="rpgsim_inline_input"
                          value={char().name}
                          onInput={(e) =>
                            props.rpgSim.updateCharacter(char().id, {
                              name: e.currentTarget.value,
                            })
                          }
                        />

                        {/* Description (user-only) */}
                        <div class="rpgsim_char_label">Description</div>
                        <textarea
                          class="rpgsim_scene_textarea"
                          placeholder="Character description..."
                          value={char().description}
                          onInput={(e) =>
                            props.rpgSim.updateCharacter(char().id, {
                              description: e.currentTarget.value,
                            })
                          }
                        />

                        {/* Emotions */}
                        <div class="rpgsim_char_label">Emotions</div>
                        <For each={EMOTION_KEYS}>
                          {(emotion) => (
                            <div
                              class={`rpgsim_emotion_row emotion_${emotion}`}
                            >
                              <span class="emotion_name">
                                {EMOTION_LABELS[emotion]}
                              </span>
                              <input
                                type="range"
                                class="emotion_slider"
                                min="0"
                                max="100"
                                value={char().emotions[emotion]}
                                onInput={(e) =>
                                  props.rpgSim.setEmotion(
                                    char().id,
                                    emotion,
                                    parseInt(e.currentTarget.value, 10),
                                  )
                                }
                              />
                              <input
                                type="number"
                                class="emotion_number"
                                min="0"
                                max="100"
                                value={char().emotions[emotion]}
                                onInput={(e) =>
                                  props.rpgSim.setEmotion(
                                    char().id,
                                    emotion,
                                    parseInt(e.currentTarget.value, 10) || 0,
                                  )
                                }
                              />
                            </div>
                          )}
                        </For>

                        {/* Thoughts */}
                        <div class="rpgsim_char_label">
                          Thoughts ({char().thoughts.length})
                        </div>
                        <Index each={char().thoughts}>
                          {(thought) => (
                            <div class="rpgsim_editable_item">
                              <input
                                class="rpgsim_inline_input"
                                value={thought().content}
                                onInput={(e) =>
                                  props.rpgSim.updateThought(
                                    char().id,
                                    thought().id,
                                    e.currentTarget.value,
                                  )
                                }
                              />
                              <i
                                class="bx bx-x rpgsim_remove_btn"
                                onclick={() =>
                                  props.rpgSim.removeThought(char().id, thought().id)
                                }
                              />
                            </div>
                          )}
                        </Index>
                        <div class="rpgsim_add_row">
                          <input
                            placeholder="Add thought..."
                            value={newThought()}
                            onInput={(e) => setNewThought(e.currentTarget.value)}
                            onKeyUp={(e) => {
                              if (e.key === "Enter") {
                                const v = newThought().trim();
                                if (!v) return;
                                props.rpgSim.addThought(char().id, v);
                                setNewThought("");
                              }
                            }}
                          />
                        </div>

                        {/* Actions */}
                        <div class="rpgsim_char_label">
                          Actions ({char().actions.length})
                        </div>
                        <Index each={char().actions}>
                          {(action) => (
                            <div
                              class={`rpgsim_editable_item action_${action().status}`}
                            >
                              <span
                                class="rpgsim_action_status"
                                title="Click to toggle status"
                                onclick={() =>
                                  props.rpgSim.updateAction(char().id, action().id, {
                                    status:
                                      action().status === "planned"
                                        ? "executed"
                                        : "planned",
                                  })
                                }
                              >
                                {action().status === "planned" ? "P" : "E"}
                              </span>
                              <input
                                class="rpgsim_inline_input"
                                value={action().content}
                                onInput={(e) =>
                                  props.rpgSim.updateAction(char().id, action().id, {
                                    content: e.currentTarget.value,
                                  })
                                }
                              />
                              <i
                                class="bx bx-x rpgsim_remove_btn"
                                onclick={() =>
                                  props.rpgSim.removeAction(char().id, action().id)
                                }
                              />
                            </div>
                          )}
                        </Index>
                        <div class="rpgsim_add_row">
                          <input
                            placeholder="Add action..."
                            value={newAction()}
                            onInput={(e) => setNewAction(e.currentTarget.value)}
                            onKeyUp={(e) => {
                              if (e.key === "Enter") {
                                const v = newAction().trim();
                                if (!v) return;
                                props.rpgSim.addAction(char().id, v);
                                setNewAction("");
                              }
                            }}
                          />
                        </div>

                        {/* Memories */}
                        <div class="rpgsim_char_label">
                          Memories ({char().memories.length})
                        </div>
                        <Index each={char().memories}>
                          {(memory) => (
                            <div class="rpgsim_editable_item">
                              <span class="rpgsim_memory_round">R{memory().round}</span>
                              <input
                                class="rpgsim_inline_input"
                                value={memory().content}
                                onInput={(e) =>
                                  props.rpgSim.updateMemory(
                                    char().id,
                                    memory().id,
                                    e.currentTarget.value,
                                  )
                                }
                              />
                              <i
                                class="bx bx-x rpgsim_remove_btn"
                                onclick={() =>
                                  props.rpgSim.removeMemory(char().id, memory().id)
                                }
                              />
                            </div>
                          )}
                        </Index>
                        <div class="rpgsim_add_row">
                          <input
                            placeholder="Add memory..."
                            value={newMemory()}
                            onInput={(e) => setNewMemory(e.currentTarget.value)}
                            onKeyUp={(e) => {
                              if (e.key === "Enter") {
                                const v = newMemory().trim();
                                if (!v) return;
                                props.rpgSim.addMemory(char().id, v);
                                setNewMemory("");
                              }
                            }}
                          />
                        </div>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </Index>

            {/* Add character */}
            <div class="rpgsim_add_row">
              <input
                placeholder="New character..."
                value={newCharName()}
                onInput={(e) => setNewCharName(e.currentTarget.value)}
                onKeyUp={(e) => {
                  if (e.key === "Enter") handleAddCharacter();
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Items ─────────────────────────────────────────── */}
        <div class="rpgsim_section">
          <div class="rpgsim_section_header">
            <div class="left">
              <i class="bx bx-box" />
              <span>Items</span>
            </div>
            <div class="right">
              <span style={{ "font-family": "var(--mono)", "font-size": "0.8em" }}>
                {state().scene.items.length}
              </span>
            </div>
          </div>
          <div class="rpgsim_section_body">
            <Index each={state().scene.items}>
              {(item) => (
                <div class="rpgsim_item_row">
                  <span>{item().name}</span>
                  <div class="right">
                    <i
                      class="bx bx-x"
                      onclick={() => props.rpgSim.removeItem(item().id)}
                    />
                  </div>
                </div>
              )}
            </Index>
            <div class="rpgsim_add_row">
              <input
                placeholder="New item..."
                value={newItemName()}
                onInput={(e) => setNewItemName(e.currentTarget.value)}
                onKeyUp={(e) => {
                  if (e.key === "Enter") handleAddItem();
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom: Status + Next Round ─────────────────────── */}
      <div class="rpgsim_bottom">
        <Show when={state().phase !== "idle"}>
          <div class={"rpgsim_status" + (state().running ? " active" : "")}>
            {state().phase === "characters"
              ? `Agent: ${state().scene.characters.find((c) => c.id === state().activeCharacterId)?.name ?? "..."}`
              : "Game master writing..."}
          </div>
        </Show>
        <div class="rpgsim_bottom_buttons">
          <button
            class="rpgsim_reset_btn"
            disabled={state().running || state().round === 0}
            title="Reset to round 0, keeping names, descriptions, and items"
            onclick={() => props.rpgSim.resetSession()}
          >
            <i class="bx bx-reset" />
          </button>
          <button
            class={
              "rpgsim_next_round_btn" + (state().running ? " running" : "")
            }
            disabled={state().running || state().scene.characters.length === 0}
            onclick={() => props.onNextRound()}
          >
            <i class={state().running ? "bx bx-loader-alt bx-spin" : "bx bx-play"} />
            <span>{state().running ? "Round in progress..." : "Next Round"}</span>
            <span class="round_label">R{state().round}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
