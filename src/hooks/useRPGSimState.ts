import { Accessor, createEffect, createSignal, Setter } from "solid-js";
import {
  RPGScene,
  RPGCharacter,
  RPGItem,
  RPGSimState,
  CharacterTurnResult,
  PlutchikEmotions,
  CharacterAction,
  DEFAULT_EMOTIONS,
  createDefaultScene,
  createDefaultCharacter,
  createDefaultItem,
  generateId,
  MAX_MEMORIES_PER_CHARACTER,
} from "../types/rpgsim.interface";

const localStorageRPGSim = "rpgsim";

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** How much of the agent's target to blend in per turn (0 = ignore agent, 1 = full replace) */
const EMOTION_LERP_FACTOR = 0.5;

function lerpEmotion(current: number, target: number): number {
  return clamp(current + (target - current) * EMOTION_LERP_FACTOR);
}

export interface UseRPGSimReturn {
  state: Accessor<RPGSimState>;

  // Scene
  setSceneDescription: (desc: string) => void;

  // Characters
  addCharacter: (name: string) => void;
  removeCharacter: (id: string) => void;
  updateCharacter: (id: string, updates: Partial<RPGCharacter>) => void;

  // Character emotions
  setEmotion: (charId: string, key: keyof PlutchikEmotions, value: number) => void;

  // Character thoughts
  addThought: (charId: string, content: string) => void;
  updateThought: (charId: string, thoughtId: string, content: string) => void;
  removeThought: (charId: string, thoughtId: string) => void;

  // Character actions
  addAction: (charId: string, content: string) => void;
  updateAction: (charId: string, actionId: string, updates: Partial<CharacterAction>) => void;
  removeAction: (charId: string, actionId: string) => void;

  // Character memories
  addMemory: (charId: string, content: string) => void;
  updateMemory: (charId: string, memoryId: string, content: string) => void;
  removeMemory: (charId: string, memoryId: string) => void;

  // Items
  addItem: (name: string) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<RPGItem>) => void;

  // Round orchestration
  setPhase: (phase: RPGSimState["phase"]) => void;
  setActiveCharacterId: (id: string | null) => void;
  setRunning: (running: boolean) => void;
  incrementRound: () => void;

  /** Apply turn results from a character agent */
  applyCharacterTurnResult: (result: CharacterTurnResult) => void;

  /** Clear a character's runtime state (emotions, thoughts, actions, memories) but keep name + description */
  clearCharacter: (charId: string) => void;

  /** Reset the entire session to round 0, keeping scene description, character names/descriptions, and items */
  resetSession: () => void;

  /** Full state setter for bulk updates */
  setState: Setter<RPGSimState>;
}

function loadState(): RPGSimState {
  const stored = localStorage.getItem(localStorageRPGSim);
  if (stored) {
    try {
      return JSON.parse(stored) as RPGSimState;
    } catch {
      // fall through
    }
  }
  return {
    scene: createDefaultScene(),
    round: 0,
    running: false,
    activeCharacterId: null,
    phase: "idle",
  };
}

export function useRPGSimState(): UseRPGSimReturn {
  const [state, setState] = createSignal<RPGSimState>(loadState());

  // Persist on every change
  createEffect(() => {
    localStorage.setItem(localStorageRPGSim, JSON.stringify(state()));
  });

  function updateScene(updater: (scene: RPGScene) => RPGScene) {
    setState((prev) => ({ ...prev, scene: updater(prev.scene) }));
  }

  /** Update a single character by id using a mapping function */
  function mapCharacter(charId: string, fn: (c: RPGCharacter) => RPGCharacter) {
    updateScene((s) => ({
      ...s,
      characters: s.characters.map((c) => (c.id === charId ? fn(c) : c)),
    }));
  }

  function setSceneDescription(desc: string) {
    updateScene((s) => ({ ...s, description: desc }));
  }

  // Characters
  function addCharacter(name: string) {
    updateScene((s) => ({
      ...s,
      characters: [...s.characters, createDefaultCharacter(name)],
    }));
  }

  function removeCharacter(id: string) {
    updateScene((s) => ({
      ...s,
      characters: s.characters.filter((c) => c.id !== id),
    }));
  }

  function updateCharacter(id: string, updates: Partial<RPGCharacter>) {
    mapCharacter(id, (c) => ({ ...c, ...updates }));
  }

  // Emotions
  function setEmotion(charId: string, key: keyof PlutchikEmotions, value: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    mapCharacter(charId, (c) => ({
      ...c,
      emotions: { ...c.emotions, [key]: clamped },
    }));
  }

  // Thoughts
  function addThought(charId: string, content: string) {
    mapCharacter(charId, (c) => ({
      ...c,
      thoughts: [...c.thoughts, { id: generateId(), content }],
    }));
  }

  function updateThought(charId: string, thoughtId: string, content: string) {
    mapCharacter(charId, (c) => ({
      ...c,
      thoughts: c.thoughts.map((t) => (t.id === thoughtId ? { ...t, content } : t)),
    }));
  }

  function removeThought(charId: string, thoughtId: string) {
    mapCharacter(charId, (c) => ({
      ...c,
      thoughts: c.thoughts.filter((t) => t.id !== thoughtId),
    }));
  }

  // Actions
  function addAction(charId: string, content: string) {
    mapCharacter(charId, (c) => ({
      ...c,
      actions: [...c.actions, { id: generateId(), content, status: "planned" as const }],
    }));
  }

  function updateAction(charId: string, actionId: string, updates: Partial<CharacterAction>) {
    mapCharacter(charId, (c) => ({
      ...c,
      actions: c.actions.map((a) => (a.id === actionId ? { ...a, ...updates } : a)),
    }));
  }

  function removeAction(charId: string, actionId: string) {
    mapCharacter(charId, (c) => ({
      ...c,
      actions: c.actions.filter((a) => a.id !== actionId),
    }));
  }

  // Memories
  function addMemory(charId: string, content: string) {
    mapCharacter(charId, (c) => ({
      ...c,
      memories: [
        ...c.memories,
        { id: generateId(), content, round: state().round },
      ].slice(-MAX_MEMORIES_PER_CHARACTER),
    }));
  }

  function updateMemory(charId: string, memoryId: string, content: string) {
    mapCharacter(charId, (c) => ({
      ...c,
      memories: c.memories.map((m) => (m.id === memoryId ? { ...m, content } : m)),
    }));
  }

  function removeMemory(charId: string, memoryId: string) {
    mapCharacter(charId, (c) => ({
      ...c,
      memories: c.memories.filter((m) => m.id !== memoryId),
    }));
  }

  // Items
  function addItem(name: string) {
    updateScene((s) => ({
      ...s,
      items: [...s.items, createDefaultItem(name)],
    }));
  }

  function removeItem(id: string) {
    updateScene((s) => ({
      ...s,
      items: s.items.filter((i) => i.id !== id),
    }));
  }

  function updateItem(id: string, updates: Partial<RPGItem>) {
    updateScene((s) => ({
      ...s,
      items: s.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    }));
  }

  // Round orchestration
  function setPhase(phase: RPGSimState["phase"]) {
    setState((prev) => ({ ...prev, phase }));
  }

  function setActiveCharacterId(id: string | null) {
    setState((prev) => ({ ...prev, activeCharacterId: id }));
  }

  function setRunning(running: boolean) {
    setState((prev) => ({ ...prev, running }));
  }

  function incrementRound() {
    setState((prev) => ({ ...prev, round: prev.round + 1 }));
  }

  function clearCharacter(charId: string) {
    mapCharacter(charId, (c) => ({
      ...c,
      emotions: { ...DEFAULT_EMOTIONS },
      memories: [],
      thoughts: [],
      actions: [],
    }));
  }

  function resetSession() {
    setState((prev) => ({
      ...prev,
      round: 0,
      running: false,
      activeCharacterId: null,
      phase: "idle" as const,
      scene: {
        ...prev.scene,
        characters: prev.scene.characters.map((c) => ({
          ...c,
          emotions: { ...DEFAULT_EMOTIONS },
          memories: [],
          thoughts: [],
          actions: [],
          collapsed: true,
        })),
      },
    }));
  }

  function applyCharacterTurnResult(result: CharacterTurnResult) {
    updateScene((s) => ({
      ...s,
      characters: s.characters.map((c) => {
        if (c.id !== result.characterId) return c;
        return {
          ...c,
          emotions: {
            joy: lerpEmotion(c.emotions.joy, result.targetEmotions.joy),
            trust: lerpEmotion(c.emotions.trust, result.targetEmotions.trust),
            fear: lerpEmotion(c.emotions.fear, result.targetEmotions.fear),
            surprise: lerpEmotion(c.emotions.surprise, result.targetEmotions.surprise),
            sadness: lerpEmotion(c.emotions.sadness, result.targetEmotions.sadness),
            disgust: lerpEmotion(c.emotions.disgust, result.targetEmotions.disgust),
            anger: lerpEmotion(c.emotions.anger, result.targetEmotions.anger),
            anticipation: lerpEmotion(c.emotions.anticipation, result.targetEmotions.anticipation),
          },
          memories: [
            ...c.memories,
            ...result.newMemories.map((content) => ({
              id: generateId(),
              content,
              round: state().round,
            })),
          ].slice(-MAX_MEMORIES_PER_CHARACTER),
          thoughts: result.thoughts.map((content) => ({
            id: generateId(),
            content,
          })),
          actions: result.plannedActions.map((content) => ({
            id: generateId(),
            content,
            status: "planned" as const,
          })),
        };
      }),
    }));
  }

  return {
    state,
    setSceneDescription,
    addCharacter,
    removeCharacter,
    updateCharacter,
    setEmotion,
    addThought,
    updateThought,
    removeThought,
    addAction,
    updateAction,
    removeAction,
    addMemory,
    updateMemory,
    removeMemory,
    addItem,
    removeItem,
    updateItem,
    setPhase,
    setActiveCharacterId,
    setRunning,
    incrementRound,
    clearCharacter,
    resetSession,
    applyCharacterTurnResult,
    setState,
  };
}
