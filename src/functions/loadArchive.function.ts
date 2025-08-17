import { StaticFile } from "../types/savedFile.interface";

export function loadArchive(name: string): StaticFile[] {
  return [
    {
      name: "a",
      content: "Foo",
    },
    {
      name: "b",
      content: "",
    },
    {
      name: "c",
      content: "Aaaaaaas",
    },
  ];
}
