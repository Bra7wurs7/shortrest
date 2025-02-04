import { Component, input, output } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-template",
  standalone: true,
  imports: [CommonModule],
  template: ` <p>boilerplate component works!</p> `,
})
export class TemplateComponent {
  input = input.required<any>();
  output = output<any>();
  constructor() {}
}
