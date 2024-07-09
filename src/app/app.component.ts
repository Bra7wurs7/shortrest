import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"], // Note the 's' added to 'styleUrl'. It was a typo in the original code.
})
export class AppComponent {
  title = "shortrest";
  files = ['file a', 'file b', 'file c', 'file d', 'file e', 'file f', 'file g', 'file h', 'file i', 'file j', 'file k', 'file l', 'file m', 'file q', 'file o', 'file p', 'file q', 'file r', 'file s', 'file t', 'file u', 'file v', 'file w', 'file x', 'file y', 'file z']
}