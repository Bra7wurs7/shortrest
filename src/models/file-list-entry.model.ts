export interface FileListEntry {
  filename: string;
  tags: string[];
  content: string;
  active: boolean;
  reading: boolean;
  children: FileListEntry[];
}
