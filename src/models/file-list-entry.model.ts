export interface fileListEntry {
  filename: string;
  tags: string[];
  description: string;
  active: boolean;
  reading: boolean;
  children: fileListEntry[];
}
