import { ParsedFileName } from "../types/parsedFileName.interface";

/**
 * Parse a filename that can have either a file-extension OR tags but never both, and will always have a base name.
 * "Foo #bar #baz" parses to the basename "Foo" and the tags "bar" and "baz" while "Spam #eggs.pdf" parses to the basename "Spam #eggs" and the ext ".pdf"
 * @param name e.g. "Thorsten Redbeard", "Braeburn #Apple" or "log.txt"
 */
export function parseFileName(name: string): ParsedFileName {
  const lastDotIndex = name.lastIndexOf(".");
  const hasExtension = lastDotIndex > -1 && lastDotIndex < name.length - 1;
  let baseName = "";
  let tags: string[] = [];
  let ext = "";

  if (hasExtension) {
    baseName = name.substring(0, lastDotIndex);
    ext = name.substring(lastDotIndex);
  } else {
    const firstHashIndex = name.indexOf("#");
    if (firstHashIndex > -1) {
      baseName = name.substring(0, firstHashIndex).trim();
      const tagPart = name.substring(firstHashIndex + 1);

      // Handle multiple tags
      tags = tagPart
        .split("#")
        .map((tag) => tag.trim())
        .filter(Boolean);
    } else {
      baseName = name;
    }
  }

  return { name, baseName, tags, ext };
}
