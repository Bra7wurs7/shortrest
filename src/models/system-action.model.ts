import { WritableSignal } from "@angular/core";

export interface SystemAction {
  visibleRegex: RegExp;
  name: string;
  description: string;
  icon: string;
  command: string;
  color: string;
  action: (param: HTMLTextAreaElement) => void;
  highlighted: WritableSignal<boolean>;
}
