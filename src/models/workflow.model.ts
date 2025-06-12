import { WorkflowNode } from "./workflow-node.model";

export interface Workflow {
  name: string;
  nodes: WorkflowNode[];
}
