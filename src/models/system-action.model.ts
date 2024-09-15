export interface SystemAction {
  visibleRegex: RegExp;
  name: string;
  description: string;
  icon: string;
  command: string;
  type: string;
  action: (param: HTMLTextAreaElement) => void;
}
