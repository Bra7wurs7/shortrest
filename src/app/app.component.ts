import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"], // Note the 's' added to 'styleUrl'. It was a typo in the original code.
})
export class AppComponent{
  title = "shortrest";
}