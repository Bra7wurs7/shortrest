import { createSignal } from "solid-js";
import { ReactiveFile } from "../types/reactiveFile.interface";
import { BasicFile } from "../types/basicFile.interface";

export function parseFile(filesJson: string): ReactiveFile[] | string {
  let files: BasicFile[];
  try {
    files = JSON.parse(filesJson);
  } catch (error) {
    return `Error parsing JSON: ${error}`;
  }

  if (!Array.isArray(files)) {
    return "The parsed result is not an array";
  }

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

      return {
        name: n,
        setName: setN,
        content: c,
        setContent: setC,
      };
    });
  } else {
    return "The array contains elements that are not valid File objects";
  }
}
