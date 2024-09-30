import { WritableSignal } from "@angular/core";

export interface SystemAction {
  visibleRegex: RegExp;
  name: string;
  advice: string;
  icon: string;
  command: string;
  color: string;
  action: (param: HTMLInputElement) => void;
  highlighted: WritableSignal<boolean>;
}
