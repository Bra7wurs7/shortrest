export interface FileListEntry {
  filename: string;
  tags: string[];
  description: string;
  active: boolean;
  reading: boolean;
  children: FileListEntry[];
}
