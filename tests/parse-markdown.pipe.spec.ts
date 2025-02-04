import { ParseMarkdownPipe } from "../src/pipes/parse-markdown.pipe";

describe("ParseMarkdownPipe", () => {
  it("create an instance", () => {
    const pipe = new ParseMarkdownPipe();
    expect(pipe).toBeTruthy();
  });
});
