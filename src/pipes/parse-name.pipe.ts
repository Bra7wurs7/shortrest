import { Pipe, PipeTransform } from "@angular/core";
import { ParsedFileName } from "../models/parsed-file-name.model";

@Pipe({
  name: "parseName",
  standalone: true,
})
export class ParseNamePipe implements PipeTransform {
  transform(value: string): ParsedFileName {
    const parsedFileName: ParsedFileName = {
      name: "",
      tags: [],
      ext: "",
    };

    // Split the value by space to handle "Name #Tag1 #Tag2 .ext" format
    const splitBySpace = value.split(" ");

    for (let i = 0; i < splitBySpace.length; i++) {
      const part = splitBySpace[i];

      // If the part starts with "#", it's a tag
      if (part.startsWith("#")) {
        parsedFileName.tags.push(part.slice(1));
      } else if (!parsedFileName.ext) {
        // Split by "." to handle extension
        const splitByDot = part.split(".");
        parsedFileName.name += ` ${splitByDot[0]}`;
        // If there's an extension, add it to ext property
        if (splitByDot.length > 1) {
          parsedFileName.ext = `.${splitByDot[1]}`;
        }
      }
    }

    // Trim the name to remove leading/trailing spaces
    parsedFileName.name = parsedFileName.name.trim();
    return parsedFileName;
  }
}
