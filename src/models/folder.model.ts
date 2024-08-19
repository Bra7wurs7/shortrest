import { File } from "./file.model";

export interface Folder {
  name: string;
  files: File[];
}
