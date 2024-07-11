import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"], // Note the 's' added to 'styleUrl'. It was a typo in the original code.
})
export class AppComponent {
  title = "shortrest";
  files = [
    {
      filename: "Katzenfoto",
      tags: ["#tag1", "#tag2"],
      description: "This is file A",
      active: false,
    },
    {
      filename: "Apfel",
      tags: ["#tag3", "#tag4", "#tag5"],
      description: "This is file B",
      active: true,
    },
    {
      filename: "File C",
      tags: ["#tag6", "#tag7"],
      description: "This is file C",
      active: false,
    },
    {
      filename: "File D",
      tags: ["#tag8", "#tag9", "#tag10"],
      description: "This is file D",
      active: true,
    },
    {
      filename: "File E",
      tags: ["#tag11", "#tag12"],
      description: "This is file E",
      active: false,
    },
    {
      filename: "File F",
      tags: ["#tag13", "#tag14", "#tag15"],
      description: "This is file F",
      active: true,
    },
    {
      filename: "File G",
      tags: ["#tag16", "#tag17"],
      description: "This is file G",
      active: false,
    },
  ];

  messages = [
    {
      role: "system",
      content:
        "Welcome to our platform! Here, you can explore various files tagged with different interests. Let's start by getting familiar with the basics.",
    },
    {
      role: "outgoing",
      content:
        "Thanks for the warm welcome! I'm new here and would love some guidance on how to navigate this platform.",
    },
    {
      role: "incoming",
      content:
        "Absolutely, we're happy to help you get started. We have files with various tags that you can browse through and explore.",
    },
    {
      role: "outgoing",
      content:
        "That sounds amazing. Could you please explain how I can find files based on specific interests or tags?",
    },
    {
      role: "incoming",
      content:
        "Certainly! Just type a tag that you're interested in the search bar and we'll display all matching files for you.",
    },
    {
      role: "outgoing",
      content:
        "Got it. So, I just need to click on 'Search', enter the tag I'm interested in, and hit enter. That easy, right?",
    },
  ];
}
