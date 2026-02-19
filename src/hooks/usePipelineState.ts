import {
  Accessor,
  createEffect,
  createMemo,
  createSignal,
  Setter,
} from "solid-js";
import { AbortableAsyncIterator, ChatResponse } from "ollama";
import { MessageNodeConfig, MessageRole } from "../types/messageNode.interface";

const localStoragePipelines = "pipelines";
const localStorageActivePipelineId = "activePipelineId";

function generateId(): string {
  return crypto.randomUUID();
}

function createDefaultNodes(): MessageNodeConfig[] {
  return [
    {
      id: generateId(),
      role: "system",
      acquisitionMode: "prepared",
      preparedContent: "",
      fileName: "",
      truncateLength: 0,
      truncateUnit: "all",
      sourcePipelineId: "",
      collapsed: false,
      disabled: false,
    },
    {
      id: generateId(),
      role: "user",
      acquisitionMode: "direct",
      preparedContent: "",
      fileName: "",
      truncateLength: 0,
      truncateUnit: "all",
      sourcePipelineId: "",
      collapsed: false,
      disabled: false,
    },
  ];
}

/** Serializable pipeline data for localStorage */
interface PipelineData {
  id: string;
  nodes: MessageNodeConfig[];
  ollamaNodeCollapsed: boolean;
}

/** Full runtime pipeline instance with reactive signals */
export interface PipelineInstance {
  id: string;
  messageNodes: Accessor<MessageNodeConfig[]>;
  setMessageNodes: Setter<MessageNodeConfig[]>;
  ollamaNodeCollapsed: Accessor<boolean>;
  setOllamaNodeCollapsed: Setter<boolean>;
  modelOutput: Accessor<string>;
  setModelOutput: Setter<string>;
  modelThoughts: Accessor<string>;
  setModelThoughts: Setter<string>;
  runningPrompt: Accessor<AbortableAsyncIterator<ChatResponse> | null>;
  setRunningPrompt: Setter<AbortableAsyncIterator<ChatResponse> | null>;
  promptLoading: Accessor<boolean>;
  setPromptLoading: Setter<boolean>;
}

function createPipelineInstance(data: PipelineData): PipelineInstance {
  const [messageNodes, setMessageNodes] = createSignal<MessageNodeConfig[]>(
    data.nodes,
  );
  const [ollamaNodeCollapsed, setOllamaNodeCollapsed] = createSignal(
    data.ollamaNodeCollapsed,
  );
  const [modelOutput, setModelOutput] = createSignal("");
  const [modelThoughts, setModelThoughts] = createSignal("");
  const [runningPrompt, setRunningPrompt] =
    createSignal<AbortableAsyncIterator<ChatResponse> | null>(null);
  const [promptLoading, setPromptLoading] = createSignal(false);

  return {
    id: data.id,
    messageNodes,
    setMessageNodes,
    ollamaNodeCollapsed,
    setOllamaNodeCollapsed,
    modelOutput,
    setModelOutput,
    modelThoughts,
    setModelThoughts,
    runningPrompt,
    setRunningPrompt,
    promptLoading,
    setPromptLoading,
  };
}

function serializePipeline(instance: PipelineInstance): PipelineData {
  return {
    id: instance.id,
    nodes: instance.messageNodes(),
    ollamaNodeCollapsed: instance.ollamaNodeCollapsed(),
  };
}

function migrateNode(raw: unknown): MessageNodeConfig {
  const node = raw as Partial<MessageNodeConfig>;
  return {
    id: node.id ?? "",
    role: node.role ?? "user",
    acquisitionMode: node.acquisitionMode ?? "prepared",
    preparedContent: node.preparedContent ?? "",
    fileName: node.fileName ?? "",
    truncateLength: node.truncateLength ?? 0,
    truncateUnit: node.truncateUnit ?? "all",
    sourcePipelineId: node.sourcePipelineId ?? "",
    collapsed: node.collapsed ?? false,
    disabled: node.disabled ?? false,
  };
}

function loadPipelines(): PipelineData[] {
  const stored = localStorage.getItem(localStoragePipelines);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((p: PipelineData) => ({
          ...p,
          nodes: p.nodes.map(migrateNode),
        }));
      }
    } catch {
      // fall through
    }
  }
  return [
    {
      id: generateId(),
      nodes: createDefaultNodes(),
      ollamaNodeCollapsed: false,
    },
  ];
}

export interface UsePipelineManagerReturn {
  pipelines: Accessor<PipelineInstance[]>;
  activePipelineId: Accessor<string>;
  setActivePipelineId: Setter<string>;
  activePipeline: Accessor<PipelineInstance>;

  addPipeline: () => void;
  removePipeline: (id: string) => void;

  // Node CRUD delegated to active pipeline
  addNode: (role: MessageRole) => void;
  removeNode: (id: string) => void;
  moveNode: (id: string, direction: "up" | "down") => void;
  updateNode: (id: string, updates: Partial<MessageNodeConfig>) => void;
}

export function usePipelineManager(): UsePipelineManagerReturn {
  const initialData = loadPipelines();
  const initialInstances = initialData.map(createPipelineInstance);

  const [pipelines, setPipelines] =
    createSignal<PipelineInstance[]>(initialInstances);

  const storedActiveId = localStorage.getItem(localStorageActivePipelineId);
  const initialActiveId =
    initialInstances.find((p) => p.id === storedActiveId)?.id ??
    initialInstances[0].id;
  const [activePipelineId, setActivePipelineId] =
    createSignal<string>(initialActiveId);

  const activePipeline = createMemo<PipelineInstance>(() => {
    const id = activePipelineId();
    return pipelines().find((p) => p.id === id) ?? pipelines()[0];
  });

  // Persist pipelines (node configs + collapsed state)
  createEffect(() => {
    const data = pipelines().map(serializePipeline);
    localStorage.setItem(localStoragePipelines, JSON.stringify(data));
  });

  // Persist active pipeline id
  createEffect(() => {
    localStorage.setItem(localStorageActivePipelineId, activePipelineId());
  });

  function addPipeline() {
    const data: PipelineData = {
      id: generateId(),
      nodes: createDefaultNodes(),
      ollamaNodeCollapsed: false,
    };
    const instance = createPipelineInstance(data);
    setPipelines([...pipelines(), instance]);
    setActivePipelineId(instance.id);
  }

  function removePipeline(id: string) {
    const current = pipelines();
    if (current.length <= 1) return;

    // Abort if running
    const target = current.find((p) => p.id === id);
    target?.runningPrompt()?.abort();

    const remaining = current.filter((p) => p.id !== id);
    setPipelines(remaining);

    if (activePipelineId() === id) {
      setActivePipelineId(remaining[0].id);
    }
  }

  // Node CRUD — delegate to active pipeline
  function addNode(role: MessageRole) {
    const p = activePipeline();
    const newNode: MessageNodeConfig = {
      id: generateId(),
      role,
      acquisitionMode: role === "user" ? "direct" : "prepared",
      preparedContent: "",
      fileName: "",
      truncateLength: 0,
      truncateUnit: "all",
      sourcePipelineId: "",
      collapsed: false,
      disabled: false,
    };
    p.setMessageNodes([...p.messageNodes(), newNode]);
  }

  function removeNode(id: string) {
    const p = activePipeline();
    p.setMessageNodes(p.messageNodes().filter((n) => n.id !== id));
  }

  function moveNode(id: string, direction: "up" | "down") {
    const p = activePipeline();
    const nodes = [...p.messageNodes()];
    const idx = nodes.findIndex((n) => n.id === id);
    if (idx === -1) return;

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= nodes.length) return;

    [nodes[idx], nodes[targetIdx]] = [nodes[targetIdx], nodes[idx]];
    p.setMessageNodes(nodes);
  }

  function updateNode(id: string, updates: Partial<MessageNodeConfig>) {
    const p = activePipeline();
    p.setMessageNodes(
      p.messageNodes().map((n) => (n.id === id ? { ...n, ...updates } : n)),
    );
  }

  return {
    pipelines,
    activePipelineId,
    setActivePipelineId,
    activePipeline,
    addPipeline,
    removePipeline,
    addNode,
    removeNode,
    moveNode,
    updateNode,
  };
}
