export interface SystemAction {
  name: string;
  description: string;
  icon: string;
  command: string;
  type: string;
  action: (param: HTMLTextAreaElement) => void;
}
