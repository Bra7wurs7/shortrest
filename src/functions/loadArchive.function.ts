import { BasicFile } from "../types/basicFile.interface";

export function loadArchive(name: string): BasicFile[] {
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
