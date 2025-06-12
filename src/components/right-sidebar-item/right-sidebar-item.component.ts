import { Component, computed, input, Signal } from "@angular/core";
import { RIGHTSIDEBARTOOLS } from "../../constants/tools.constant";

@Component({
  selector: "app-right-sidebar-item",
  imports: [],
  templateUrl: "./right-sidebar-item.component.html",
  styleUrl: "./right-sidebar-item.component.scss",
})
export class RightSidebarItemComponent {
  toolName = input.required<keyof typeof RIGHTSIDEBARTOOLS>();

  tool: Signal<{
    name: string;
    inputSchema: { type: string; properties: Record<string, any> };
    outputSchema: { type: string; properties: Record<string, any> };
    description: string;
  }> = computed(() => RIGHTSIDEBARTOOLS[this.toolName()]);

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

  inputProperties: Signal<any> = input<any>({
    fileName: "Foobergoob",
    readType: "Schmoog",
    readAmount: 5,
    readEnd: true,
  });

  outputProperties: any = {
    text: "Foobergoob",
  };
}
