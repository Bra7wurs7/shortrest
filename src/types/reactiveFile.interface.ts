import { Accessor, Setter } from "solid-js";

export interface ReactiveFile {
  name: Accessor<string>;
  setName: Setter<string>;
  content: Accessor<string>;
  setContent: Setter<string>;
}
