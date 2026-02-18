import { Accessor, createEffect, createSignal, Setter } from "solid-js";
import { MessageNodeConfig, MessageRole } from "../types/messageNode.interface";

const localStorageMessageNodes = "pipelineMessageNodes";
const localStorageOllamaNodeCollapsed = "pipelineOllamaNodeCollapsed";

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
      collapsed: false,
      disabled: false,
    },
    {
      id: generateId(),
      role: "user",
      acquisitionMode: "direct",
      preparedContent: "",
      fileName: "",
      collapsed: false,
      disabled: false,
    },
  ];
}

function loadNodes(): MessageNodeConfig[] {
  const stored = localStorage.getItem(localStorageMessageNodes);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // fall through
    }
  }
  return createDefaultNodes();
}

export interface UsePipelineStateReturn {
  messageNodes: Accessor<MessageNodeConfig[]>;
  setMessageNodes: Setter<MessageNodeConfig[]>;
  ollamaNodeCollapsed: Accessor<boolean>;
  setOllamaNodeCollapsed: Setter<boolean>;
  modelOutput: Accessor<string>;
  setModelOutput: Setter<string>;

  addNode: (role: MessageRole) => void;
  removeNode: (id: string) => void;
  moveNode: (id: string, direction: "up" | "down") => void;
  updateNode: (id: string, updates: Partial<MessageNodeConfig>) => void;
}

export function usePipelineState(): UsePipelineStateReturn {
  const [messageNodes, setMessageNodes] =
    createSignal<MessageNodeConfig[]>(loadNodes());
  const [ollamaNodeCollapsed, setOllamaNodeCollapsed] = createSignal<boolean>(
    JSON.parse(
      localStorage.getItem(localStorageOllamaNodeCollapsed) ?? "false",
    ),
  );
  const [modelOutput, setModelOutput] = createSignal<string>("");

  // Persist nodes
  createEffect(() => {
    localStorage.setItem(
      localStorageMessageNodes,
      JSON.stringify(messageNodes()),
    );
  });

  // Persist ollama node collapsed state
  createEffect(() => {
    localStorage.setItem(
      localStorageOllamaNodeCollapsed,
      JSON.stringify(ollamaNodeCollapsed()),
    );
  });

  function addNode(role: MessageRole) {
    const newNode: MessageNodeConfig = {
      id: generateId(),
      role,
      acquisitionMode: role === "user" ? "direct" : "prepared",
      preparedContent: "",
      fileName: "",
      collapsed: false,
      disabled: false,
    };
    setMessageNodes([...messageNodes(), newNode]);
  }

  function removeNode(id: string) {
    setMessageNodes(messageNodes().filter((n) => n.id !== id));
  }

  function moveNode(id: string, direction: "up" | "down") {
    const nodes = [...messageNodes()];
    const idx = nodes.findIndex((n) => n.id === id);
    if (idx === -1) return;

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= nodes.length) return;

    [nodes[idx], nodes[targetIdx]] = [nodes[targetIdx], nodes[idx]];
    setMessageNodes(nodes);
  }

  function updateNode(id: string, updates: Partial<MessageNodeConfig>) {
    setMessageNodes(
      messageNodes().map((n) => (n.id === id ? { ...n, ...updates } : n)),
    );
  }

  return {
    messageNodes,
    setMessageNodes,
    ollamaNodeCollapsed,
    setOllamaNodeCollapsed,
    modelOutput,
    setModelOutput,
    addNode,
    removeNode,
    moveNode,
    updateNode,
  };
}
