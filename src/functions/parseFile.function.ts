import { createSignal } from "solid-js";
import { OpenFile } from "../types/openFile.interface";
import { StaticFile } from "../types/savedFile.interface";

/** @author Sebastian Pöhlmann & Codestral:0898a8b286d5 */
export function parseFile(filesJson: string): OpenFile[] | string {
  let files: StaticFile[];
  try {
    // Try to parse the JSON string
    files = JSON.parse(filesJson);
  } catch (error) {
    return `Error parsing JSON: ${error}`;
  }

  if (!Array.isArray(files)) {
    return "The parsed result is not an array";
  }

  // Check that all elements in the array have the required properties for SavedFile
  if (
    files.every(
      (file) =>
        "name" in file &&
        typeof file.name === "string" &&
        "content" in file &&
        typeof file.content === "string",
    )
  ) {
    return files.map(({ name, content }) => {
      const [n, setN] = createSignal(name);
      const [c, setC] = createSignal(content);
      return { name: n, setName: setN, content: c, setContent: setC };
    });
  } else {
    return "The array contains elements that are not valid File objects";
  }
}
