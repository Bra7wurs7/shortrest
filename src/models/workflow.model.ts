import { WorkflowNode } from "./workflow-node.model";

export interface Workflow {
  globalVariables: Record<string, any>;
  name: string;
  nodes: WorkflowNode[];
}
