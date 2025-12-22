import { Accessor, createSignal } from "solid-js";
import { ReactiveFile } from "../types/reactiveFile.interface";
import { idbGetFile } from "./idbFiles.service";

/** Returns true when the file content of the open file with the given name is different from the content of the file stored in the IDB */
export async function OpenFileContentDifferentToSavedFileContent(
  openFileName: string,
  activeDirectoryName: Accessor<string | null>,
  openFiles: Accessor<ReactiveFile[]>,
): Promise<boolean> {
  const files = openFiles();
  const openFile = files.find((file) => file.name() === openFileName);

  if (!openFile) {
    return false;
  }

  const currentContent = openFile.content();
  const savedContent = await idbGetFile(
    activeDirectoryName() ?? "",
    openFileName,
  );

  return currentContent !== savedContent;
}
