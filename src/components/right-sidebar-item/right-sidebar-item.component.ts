import { Component, computed, effect, input, Signal } from "@angular/core";
import { RIGHTSIDEBARTOOLS } from "../../constants/tools.constant";
import { WorkflowNode } from "../../models/workflow-node.model";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-right-sidebar-item",
  imports: [CommonModule],
  templateUrl: "./right-sidebar-item.component.html",
})
export class RightSidebarItemComponent {
  node = input.required<WorkflowNode>();
  isInvalid = true;

  tool: Signal<{
    name: string;
    inputSchema: { type: string; properties: Record<string, any> };
    outputSchema: { type: string; properties: Record<string, any> };
    description: string;
  }> = computed(() => RIGHTSIDEBARTOOLS[this.node().tool]);

  inputSchemaProperties: Signal<
    Array<{ key: string; type: string; description: string }>
  > = computed(() => {
    const tool = this.tool();
    let schema = tool.inputSchema;
    let schemaKeys = Object.keys(schema.properties);
    let properties: Array<{ key: string; type: string; description: string }> =
      [];
    if (schema.type === "object" && schemaKeys !== undefined) {
      for (const key of schemaKeys) {
        properties.push({
          key,
          type: `${schema.properties[key].type ?? ""}`,
          description: `${schema.properties[key].description ?? ""}`,
        });
      }
    }
    return properties;
  });

  outputSchemaProperties: Signal<
    Array<{ key: string; type: string; description: string }>
  > = computed(() => {
    const tool = this.tool();
    let schema = tool.outputSchema;
    let schemaKeys = Object.keys(schema.properties);
    let properties: Array<{ key: string; type: string; description: string }> =
      [];
    if (schema.type === "object" && schemaKeys !== undefined) {
      for (const key of schemaKeys) {
        properties.push({
          key,
          type: `${schema.properties[key].type ?? ""}`,
          description: `${schema.properties[key].description ?? ""}`,
        });
      }
    }
    return properties;
  });

  constructor() {
    effect(() => {
      console.log(this.node());
      this.validate();
    });
  }

  validate() {
    console.log(this.node());
    this.isInvalid = !validateNode(this.node());
  }
}

export function validateNode(node: WorkflowNode): boolean {
  switch (node.tool) {
    case "readFile":
      return validateReadFileNode(node as WorkflowNode & { tool: "readFile" });
    default:
      return true;
  }
}

export function validateReadFileNode(
  node: WorkflowNode & { tool: "readFile" },
): boolean {
  const properties = RIGHTSIDEBARTOOLS["readFile"].inputSchema.properties;
  console.log(properties);
  for (const key of Object.keys(properties)) {
    if (
      node.inputProperties[key] === undefined ||
      node.inputProperties[key] === ""
    ) {
      return false;
    }
  }
  return true;
}
