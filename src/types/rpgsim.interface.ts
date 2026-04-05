/** Max memories kept per character (oldest are pruned) */
export const MAX_MEMORIES_PER_CHARACTER = 50;
/** Max actions/memories shown in the character agent's system prompt */
export const MAX_PROMPT_LIST_ITEMS = 10;

/** crypto.randomUUID requires a secure context; fall back gracefully */
export function generateId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Plutchik's 8 primary emotions — each tracked as intensity 0–100%.
 */
export interface PlutchikEmotions {
  joy: number;
  trust: number;
  fear: number;
  surprise: number;
  sadness: number;
  disgust: number;
  anger: number;
  anticipation: number;
}

export const DEFAULT_EMOTIONS: PlutchikEmotions = {
  joy: 33,
  trust: 33,
  fear: 33,
  surprise: 33,
  sadness: 33,
  disgust: 33,
  anger: 33,
  anticipation: 33,
};

export interface CharacterMemory {
  id: string;
  content: string;
  /** Round number when this memory was created */
  round: number;
  /** Pinned items survive round updates, clear, and reset */
  pinned?: boolean;
}

export interface CharacterThought {
  id: string;
  content: string;
  /** Pinned items survive round updates, clear, and reset */
  pinned?: boolean;
}

export interface CharacterAction {
  id: string;
  content: string;
  /** "planned" = intent declared by agent, "executed" = confirmed by game master */
  status: "planned" | "executed";
  /** Pinned items survive round updates, clear, and reset */
  pinned?: boolean;
}

export interface RPGCharacter {
  id: string;
  name: string;
  description: string;
  emotions: PlutchikEmotions;
  memories: CharacterMemory[];
  thoughts: CharacterThought[];
  actions: CharacterAction[];
  /** Collapsed in the sidebar UI */
  collapsed: boolean;
}

export interface RPGItem {
  id: string;
  name: string;
  description: string;
}

export interface RPGScene {
  description: string;
  characters: RPGCharacter[];
  items: RPGItem[];
}

/** Summary returned by a character agent via endTurn() */
export interface CharacterTurnResult {
  characterId: string;
  summary: string;
  /** Target emotions the agent wants to reach (0–100); applied via lerp from current state */
  targetEmotions: PlutchikEmotions;
  /** New memories added this turn */
  newMemories: string[];
  /** Current thoughts after processing */
  thoughts: string[];
  /** Planned actions for the game master to evaluate */
  plannedActions: string[];
}

/** The state of a single RPGSim session */
export interface RPGSimState {
  scene: RPGScene;
  /** Current round number (starts at 0, incremented after each GM turn) */
  round: number;
  /** Whether agents are currently processing */
  running: boolean;
  /** Which character is currently being processed (null if idle or GM turn) */
  activeCharacterId: string | null;
  /** "characters" = character agents running, "gm" = game master writing, "idle" = waiting */
  phase: "idle" | "characters" | "gm";
}

export function createDefaultScene(): RPGScene {
  return {
    description: "",
    characters: [],
    items: [],
  };
}

export function createDefaultCharacter(name: string): RPGCharacter {
  return {
    id: generateId(),
    name,
    description: "",
    emotions: { ...DEFAULT_EMOTIONS },
    memories: [],
    thoughts: [],
    actions: [],
    collapsed: true,
  };
}

export function createDefaultItem(name: string): RPGItem {
  return {
    id: generateId(),
    name,
    description: "",
  };
}
