import { Pipe, PipeTransform } from "@angular/core";
import { ParsedFileName } from "../models/parsed-file-name.model";

@Pipe({
  name: "parseName",
  standalone: true,
})
export class ParseNamePipe implements PipeTransform {
  transform(value: string): ParsedFileName {
    const pattern = /^(?:\((.*?)\))? ?([^\.]+)?(?:\.(.*))?$/; // Matches the provided string format with optional groups for tags and extensions.
    const match = value.match(pattern);

    let parsedNode: ParsedFileName = {
      name: "",
      tags: [],
      ext: "",
    };

    if (match) {
      if (match[2]) {
        parsedNode.name = match[2]!.trim();
      }
      if (match[1]) {
        parsedNode.tags = match[1].split(", ").map((tag) => tag.trim());
      }
      if (match[3]) {
        parsedNode.ext = `.${match[3]}`;
      }
    } else {
      // The entire value doesn't conform to our pattern. Let's see if it starts with a parentheses which is not properly closed and extract the tags.
      const tagMatch = /^\((.*?)\) ?([^\.)]+)/.exec(value); // Try to match just for tag(s) and name.
      if (tagMatch) {
        parsedNode.tags = tagMatch[1].split(", ").map((tag) => tag.trim());
        parsedNode.name = tagMatch[2]!.trim();
      } else {
        // The value doesn't even match our relaxed pattern. Let's see if it ends with a dot extension or just contains name part.
        const extOrNameOnlyPattern = /^([^\.]*)(?:\.(.*))?$/; // Match for potential name and/or extension
        const extMatch = value.match(extOrNameOnlyPattern);
        if (extMatch) {
          if (extMatch[1]) {
            parsedNode.name = extMatch[1].trim();
          }
          if (extMatch[2]) {
            parsedNode.ext = `.${extMatch[2]}`;
          }
        } else {
          // If nothing matches at all, just consider the entire input string as name.
          parsedNode.name = value.trim();
        }
      }
    }

    return parsedNode;
  }
}
