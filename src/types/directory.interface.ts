import { Accessor, Setter } from "solid-js";
import { BasicFile } from "./basicFile.interface";

export interface Directory {
  name: string;
  files: Accessor<BasicFile[]>;
  setFiles: Setter<BasicFile[]>;
}
