import { ParseNamePipe } from "../src/pipes/parse-name.pipe";

describe("ParseNamePipe", () => {
  it("create an instance", () => {
    const pipe = new ParseNamePipe();
    expect(pipe).toBeTruthy();
  });
});
