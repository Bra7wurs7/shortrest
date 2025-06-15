import { RIGHTSIDEBARTOOLS } from "../constants/tools.constant";

export interface WorkflowNode {
  name: string;
  tool: keyof typeof RIGHTSIDEBARTOOLS;
  inputProperties: Record<string, any>;
  outputProperties: Record<string, any>;
}
