import { Accessor, Setter } from "solid-js";

export interface OpenFile {
  name: Accessor<string>;
  setName: Setter<string>;
  content: Accessor<string>;
  setContent: Setter<string>;
}
