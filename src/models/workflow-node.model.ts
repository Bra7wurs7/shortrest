import { RIGHTSIDEBARTOOLS } from "../constants/tools.constant";

export interface WorkflowNode {
  name: string;
  tool: keyof typeof RIGHTSIDEBARTOOLS;
  inputProperties: any;
  outputProperties: any;
}
