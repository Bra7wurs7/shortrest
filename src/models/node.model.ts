/** representing a  */
export interface NamedNode {
  /** The name of the file that this node represents e.g. "Name#tag1#tag2.ext" or "Apple #Rosacae #Tree .md" */
  name: string;
  /** The content of this node as a string if it's text-based, or as a Blob for binary data */
  content: string | Blob;
}

export interface ParsedNodeName {
  /** Represents the base name of a node without any tag or extension information. */
  name: string;
  /** // An array containing all the tags associated with a node extracted from its name. */
  tags: string[];
  /** The file extension of the node */
  ext: string;
}
