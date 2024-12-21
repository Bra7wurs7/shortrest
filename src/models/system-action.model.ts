import { WritableSignal } from "@angular/core";

export interface SystemAction {
  visibleRegex: RegExp;
  name: string;
  advice: string;
  icon: string;
  command: string;
  color: string;
  action: (self: SystemAction, param: HTMLInputElement) => void;
  paramRequired: boolean;
}
