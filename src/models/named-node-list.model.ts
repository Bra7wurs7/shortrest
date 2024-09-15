import { NamedNode } from "./node.model";

export interface NamedNodeMap {
  name: string;
  nodes: Map<string, NamedNode>;
}
