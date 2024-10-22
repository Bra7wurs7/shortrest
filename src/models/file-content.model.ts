export interface FileContent {
  /** The content of a file as string if it's text-based, or as a Blob for binary data */
  content: string | Blob;
}
