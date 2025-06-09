import {
  Component,
  computed,
  input,
  signal,
  Signal,
  WritableSignal,
} from "@angular/core";
import { map } from "rxjs";

@Component({
  selector: "app-right-sidebar-item",
  imports: [],
  templateUrl: "./right-sidebar-item.component.html",
  styleUrl: "./right-sidebar-item.component.scss",
})
export class RightSidebarItemComponent {
  inputSchemaName: Signal<keyof typeof schemas> = input<keyof typeof schemas>(
    "readFileInputSchema",
  );

  inputSchema: Signal<{ type: string; properties: Record<string, any> }> =
    computed(() => {
      let foo = schemas[this.inputSchemaName()];
      return foo;
    });

  inputSchemaProperties: Signal<
    Array<{ key: string; type: string; description: string }>
  > = computed(() => {
    let schema = this.inputSchema();
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
  inputProperties: Signal<any> = input<any>();
}

const schemas = {
  readFileInputSchema: {
    type: "object",
    properties: {
      fileName: {
        type: "string",
        description: "Name of the file to read",
      },
      readType: {
        type: "string",
        description: "Whether to read 'all', 'paragraphs' or 'words'",
      },
      readAmount: {
        type: "number",
        description: "The maximum number of text units to read from the file",
      },
      readEnd: {
        type: "boolean",
        description: "whether to read the end of the file instead of its start",
      },
    },
  },
  readFileOutputSchema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description:
          "the first/last {readAmount} words or paragraphs of the text",
      },
    },
  },
};
