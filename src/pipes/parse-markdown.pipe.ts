import { Pipe, PipeTransform } from "@angular/core";
import { marked } from "marked";

@Pipe({
  name: "parseMarkdown",
  standalone: true,
})
export class ParseMarkdownPipe implements PipeTransform {
  async transform(value: string | Blob): Promise<string> {
    if (value instanceof Blob) {
      return "";
    } else {
      return marked(value);
    }
  }
}
