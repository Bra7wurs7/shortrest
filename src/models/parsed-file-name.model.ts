export interface ParsedFileName {
  /** Represents the base name of a node without any tag or extension information. */
  name: string;
  /** // An array containing all the tags associated with a node extracted from its name. */
  tags: string[];
  /** The file extension of the node */
  ext: string;
}
