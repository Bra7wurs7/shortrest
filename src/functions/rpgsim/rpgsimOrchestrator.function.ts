import type {
  LLMProvider,
  LLMModelInfo,
  LLMMessage,
  NativeTool,
  NativeToolCall,
} from "../../types/llmProvider.interface";
import type {
  RPGCharacter,
  RPGScene,
  CharacterTurnResult,
  PlutchikEmotions,
} from "../../types/rpgsim.interface";
import { DEFAULT_EMOTIONS, MAX_PROMPT_LIST_ITEMS } from "../../types/rpgsim.interface";

// ─── Character Agent Tools ──────────────────────────────────────────────────

const CHARACTER_TOOLS: NativeTool[] = [
  {
    type: "function",
    function: {
      name: "endTurn",
      description:
        "End this character's turn. Provide a summary of the character's current state and intended actions for the game master.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description:
              "A concise summary of the character's state and action intentions, focused on what is relevant to the current situation.",
          },
          emotions: {
            type: "object",
            description:
              "Target Plutchik emotion intensities (0-100) after processing this turn's events. Keys: joy, trust, fear, surprise, sadness, disgust, anger, anticipation.",
            properties: {
              joy: { type: "number" },
              trust: { type: "number" },
              fear: { type: "number" },
              surprise: { type: "number" },
              sadness: { type: "number" },
              disgust: { type: "number" },
              anger: { type: "number" },
              anticipation: { type: "number" },
            },
            required: [
              "joy", "trust", "fear", "surprise",
              "sadness", "disgust", "anger", "anticipation",
            ],
          },
          newMemories: {
            type: "array",
            description: "New memories to store from this turn (only truly memorable events).",
            items: { type: "string" },
          },
          thoughts: {
            type: "array",
            description: "The character's current thoughts — what is on their mind RIGHT NOW. These replace previous thoughts entirely. Keep to 1-3 key thoughts.",
            items: { type: "string" },
          },
          plannedActions: {
            type: "array",
            description: "1-2 concrete, specific physical actions the character will take THIS turn. Not intentions or wishes — actual actions that the game master can narrate. These replace previous actions.",
            items: { type: "string" },
          },
        },
        required: ["summary", "emotions", "thoughts", "plannedActions"],
      },
    },
  },
];

function buildCharacterSystemPrompt(character: RPGCharacter, scene: RPGScene, round: number): string {
  const recentMemories = character.memories.slice(-MAX_PROMPT_LIST_ITEMS);
  const memoriesText = recentMemories.length > 0
    ? recentMemories.map((m) => `- [R${m.round}] ${m.content}`).join("\n")
    : "(none)";

  const thoughtsText = character.thoughts.length > 0
    ? character.thoughts.map((t) => `- ${t.content}`).join("\n")
    : "(none)";

  const recentActions = character.actions.slice(-MAX_PROMPT_LIST_ITEMS);
  const actionsText = recentActions.length > 0
    ? recentActions.map((a) => `- [${a.status}] ${a.content}`).join("\n")
    : "(none)";

  const emotionsText = Object.entries(character.emotions)
    .map(([k, v]) => `${k}: ${v}%`)
    .join(", ");

  const otherChars = scene.characters
    .filter((c) => c.id !== character.id)
    .map((c) => `- ${c.name}: ${c.description}`)
    .join("\n");

  const itemsText = scene.items.length > 0
    ? scene.items.map((i) => `- ${i.name}: ${i.description}`).join("\n")
    : "(none)";

  return `You are ${character.name} in a role-playing simulation (round ${round}).

## Your Description
${character.description || "(not defined)"}

## Scene
${scene.description || "(not defined)"}

## Other Characters
${otherChars || "(none)"}

## Items in the Scene
${itemsText}

## Your Current State
Emotions: ${emotionsText}
Current Thoughts:
${thoughtsText}
Last Round's Actions:
${actionsText}
Memories:
${memoriesText}

## Your Task
React to the current situation from the perspective of ${character.name}. Consider your emotional state, memories, and thoughts. Decide how your state changes and what actions you plan to take.

At the end of your turn, call the "endTurn" tool to report your results to the game master.
- **Thoughts**: Provide your current thoughts (1-3). These replace your previous thoughts.
- **Actions**: Provide 1-2 concrete physical actions you will take THIS turn. Be specific — the game master needs to narrate exactly what you do.
- **Emotions**: Provide the target intensity (0-100) for each emotion after this turn's events.
- **Memories**: Only store truly important events worth remembering long-term.`;
}

function buildGameMasterSystemPrompt(scene: RPGScene, round: number): string {
  return `You are the game master of a role-playing simulation (round ${round}).

## Scene
${scene.description || "(not defined)"}

## Characters
${scene.characters.map((c) => `- ${c.name}: ${c.description}`).join("\n")}

## Items
${scene.items.length > 0 ? scene.items.map((i) => `- ${i.name}: ${i.description}`).join("\n") : "(none)"}

## Your Task
You will receive the full internal state of each character after they have processed the current situation. This includes their emotional state, thoughts, and planned actions. Use ALL of this information to write the next part of the story. Keep in mind:
- Each character's planned actions MUST be addressed in the narrative — either they succeed, partially succeed, or fail, but they must be depicted
- Use emotional states and thoughts to inform HOW characters act (body language, tone of voice, hesitation, confidence, etc.)
- Write in the third person, past tense
- Be descriptive but concise (1-3 paragraphs)
- Consider interactions and conflicts between characters
- Describe environmental changes when relevant
- Write ONLY the continuation of the story, no meta-commentary`;
}

/** Coerce a value to a number clamped 0–100, returning fallback on failure */
function clampEmotion(v: unknown, fallback: number): number {
  const n = Number(v);
  if (Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Coerce a value into a string array — handles bare strings and missing values */
function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") return [v];
  return [];
}

/** Parse the endTurn tool call arguments into a CharacterTurnResult */
function parseEndTurnArgs(
  characterId: string,
  args: Record<string, unknown>,
  previousEmotions: PlutchikEmotions = DEFAULT_EMOTIONS,
): CharacterTurnResult {
  const emotions = (args.emotions ?? {}) as Partial<PlutchikEmotions>;

  return {
    characterId,
    summary: String(args.summary ?? ""),
    targetEmotions: {
      joy: clampEmotion(emotions.joy, previousEmotions.joy),
      trust: clampEmotion(emotions.trust, previousEmotions.trust),
      fear: clampEmotion(emotions.fear, previousEmotions.fear),
      surprise: clampEmotion(emotions.surprise, previousEmotions.surprise),
      sadness: clampEmotion(emotions.sadness, previousEmotions.sadness),
      disgust: clampEmotion(emotions.disgust, previousEmotions.disgust),
      anger: clampEmotion(emotions.anger, previousEmotions.anger),
      anticipation: clampEmotion(emotions.anticipation, previousEmotions.anticipation),
    },
    newMemories: toStringArray(args.newMemories),
    thoughts: toStringArray(args.thoughts),
    plannedActions: toStringArray(args.plannedActions),
  };
}

/**
 * Trim text to approximately `maxLen` characters, cutting at a sentence
 * boundary so the LLM never sees a half-sentence.
 */
function trimToSentenceBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const slice = text.slice(text.length - maxLen);
  // Find the first sentence-ending punctuation followed by whitespace
  const match = slice.match(/[.!?]\s/);
  if (match && match.index !== undefined) {
    return slice.slice(match.index + 1).trimStart();
  }
  // Fallback: cut at first whitespace to avoid splitting a word
  const ws = slice.indexOf(" ");
  return ws >= 0 ? slice.slice(ws + 1) : slice;
}

export interface RPGSimRoundContext {
  provider: LLMProvider;
  model: LLMModelInfo;
  scene: RPGScene;
  round: number;
  /** Recent story text to provide context to character agents */
  recentStory: string;
  /** Callbacks */
  onCharacterStart: (characterId: string) => void;
  onCharacterEnd: (result: CharacterTurnResult) => void;
  onGMStart: () => void;
  /** Called with story chunks as they stream */
  onGMChunk: (text: string) => void;
  onGMEnd: (fullText: string) => void;
}

/**
 * Run a single RPGSim round:
 * 1. Each character agent processes their turn (sequentially)
 * 2. The game master writes the next story segment
 *
 * Returns the full story text written by the GM.
 */
export async function runRPGSimRound(ctx: RPGSimRoundContext): Promise<string> {
  const turnResults: CharacterTurnResult[] = [];

  const recentStory = trimToSentenceBoundary(ctx.recentStory, 2000);

  // ── Phase 1: Character agents ──────────────────────────────────────

  for (const character of ctx.scene.characters) {
    ctx.onCharacterStart(character.id);

    const systemPrompt = buildCharacterSystemPrompt(character, ctx.scene, ctx.round);
    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
    ];

    // Give the character the recent story as context
    if (recentStory) {
      messages.push({
        role: "user",
        content: `The following has just happened in the story:\n\n${recentStory}\n\nReact as ${character.name} to these events.`,
      });
    } else {
      messages.push({
        role: "user",
        content: `The story begins. React as ${character.name} to the opening situation.`,
      });
    }

    // Call LLM with character tools, retrying if endTurn is not called
    const MAX_AGENT_RETRIES = 3;
    let result: CharacterTurnResult | null = null;

    for (let attempt = 0; attempt < MAX_AGENT_RETRIES; attempt++) {
      const attemptMessages = [...messages];
      if (attempt > 0) {
        attemptMessages.push({
          role: "user",
          content: "You must call the endTurn tool to complete your turn. Please call it now.",
        });
      }

      const stream = await ctx.provider.chat({
        model: ctx.model.id,
        messages: attemptMessages,
        stream: true,
        tools: CHARACTER_TOOLS,
      });

      for await (const _chunk of stream) {
        // Discard content — we only care about the tool call
      }

      const final = await stream.final();
      const endTurnCall = final.toolCalls?.find(
        (tc: NativeToolCall) => tc.name === "endTurn",
      );

      if (endTurnCall) {
        result = parseEndTurnArgs(character.id, endTurnCall.args, character.emotions);
        break;
      }

      console.warn(
        `[RPGSim] ${character.name} did not call endTurn (attempt ${attempt + 1}/${MAX_AGENT_RETRIES}).`,
        "Tool calls:", final.toolCalls,
      );
    }

    if (!result) {
      result = {
        characterId: character.id,
        summary: `(${character.name} did not respond)`,
        targetEmotions: { ...character.emotions },
        newMemories: [],
        thoughts: [`[System: agent failed to call endTurn after ${MAX_AGENT_RETRIES} attempts]`],
        plannedActions: [],
      };
    }

    turnResults.push(result);
    ctx.onCharacterEnd(result);
  }

  // ── Phase 2: Game Master ───────────────────────────────────────────

  ctx.onGMStart();

  const gmSystem = buildGameMasterSystemPrompt(ctx.scene, ctx.round);
  const turnDetails = turnResults
    .map((r) => {
      const char = ctx.scene.characters.find((c) => c.id === r.characterId);
      const charName = char?.name ?? "???";
      const emotionStr = Object.entries(r.targetEmotions)
        .map(([k, v]) => `${k}: ${v}%`)
        .join(", ");

      const thoughtsStr = r.thoughts.length > 0
        ? r.thoughts.map((t) => `- ${t}`).join("\n")
        : "(none)";

      const actionsStr = r.plannedActions.length > 0
        ? r.plannedActions.map((a) => `- ${a}`).join("\n")
        : "(none)";

      return `### ${charName}
**Summary:** ${r.summary}
**Emotional state:** ${emotionStr}
**Thoughts:**
${thoughtsStr}
**Planned actions:**
${actionsStr}`;
    })
    .join("\n\n");

  const storyContext = recentStory
    ? `## Story so far (most recent excerpt)\n${recentStory}\n\n---\n\n`
    : "";

  const gmMessages: LLMMessage[] = [
    { role: "system", content: gmSystem },
    {
      role: "user",
      content: `${storyContext}Here is the full internal state of each character after processing this round:\n\n${turnDetails}\n\nContinue the story exactly where it left off, making sure every planned action is addressed in the narrative.`,
    },
  ];

  const gmStream = await ctx.provider.chat({
    model: ctx.model.id,
    messages: gmMessages,
    stream: true,
  });

  let fullStory = "";
  for await (const chunk of gmStream) {
    if (chunk.content) {
      fullStory += chunk.content;
      ctx.onGMChunk(chunk.content);
    }
  }

  ctx.onGMEnd(fullStory);
  return fullStory;
}
