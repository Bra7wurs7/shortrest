import {
  MessageNodeConfig,
  MessageRole,
} from "../../types/messageNode.interface";

function generateId(): string {
  return crypto.randomUUID();
}

export function createDefaultNode(role: MessageRole): MessageNodeConfig {
  return {
    id: generateId(),
    role,
    acquisitionMode: role === "user" ? "direct" : "prepared",
    preparedContent: "",
    fileName: "",
    truncateLength: 0,
    truncateUnit: "all",
    sourcePipelineId: "",
    subPipelineParams: [],
    collapsed: false,
    disabled: false,
    toolbeltTools: {},
    toolbeltType: "workspace",
  };
}

export function addNodeToNodes(
  nodes: MessageNodeConfig[],
  role: MessageRole,
): MessageNodeConfig[] {
  return [...nodes, createDefaultNode(role)];
}

export function addHistoryNodeToNodes(
  nodes: MessageNodeConfig[],
): MessageNodeConfig[] {
  const node: MessageNodeConfig = {
    id: generateId(),
    role: "user",
    acquisitionMode: "history",
    preparedContent: "",
    fileName: "",
    truncateLength: 0,
    truncateUnit: "all",
    sourcePipelineId: "",
    subPipelineParams: [],
    collapsed: false,
    disabled: false,
    toolbeltTools: {},
    toolbeltType: "workspace",
  };
  return [...nodes, node];
}

export function removeNodeFromNodes(
  nodes: MessageNodeConfig[],
  id: string,
): MessageNodeConfig[] {
  return nodes.filter((n) => n.id !== id);
}

export function moveNodeInNodes(
  nodes: MessageNodeConfig[],
  id: string,
  direction: "up" | "down",
): MessageNodeConfig[] {
  const result = [...nodes];
  const idx = result.findIndex((n) => n.id === id);
  if (idx === -1) return nodes;

  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= result.length) return nodes;

  [result[idx], result[targetIdx]] = [result[targetIdx], result[idx]];
  return result;
}

export function updateNodeInNodes(
  nodes: MessageNodeConfig[],
  id: string,
  updates: Partial<MessageNodeConfig>,
): MessageNodeConfig[] {
  return nodes.map((n) => (n.id === id ? { ...n, ...updates } : n));
}
