import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { fileListEntry } from "../models/file-list-entry.model";
import { FileListEntryComponent } from "../components/file-list-entry/file-list-entry.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, CommonModule, FileListEntryComponent],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent {
  title = "shortrest";
  files: fileListEntry[] = [
    {
      filename: "Apfel",
      tags: ["Rosengewächs", "Frucht"],
      description: "This is file A",
      active: false,
      children: [
        {
          filename: "Braeburn",
          tags: ["tag1", "tag2"],
          description: "This is file A",
          active: false,
        },
        {
          filename: "Jonagold",
          tags: ["tag3", "tag4", "tag5"],
          description: "This is file B",
          active: true,
        },
      ],
    },
    {
      filename: "File B",
      tags: ["tag3", "tag4", "tag5"],
      description: "This is file B",
      active: true,
    },
    {
      filename: "File C",
      tags: ["tag6", "tag7"],
      description: "This is file C",
      active: false,
    },
    {
      filename: "File D",
      tags: ["tag8", "tag9", "tag10"],
      description: "This is file D",
      active: true,
    },
    {
      filename: "File E",
      tags: ["tag11", "tag12"],
      description: "This is file E",
      active: false,
    },
    {
      filename: "File F",
      tags: ["tag13", "tag14", "tag15"],
      description: "This is file F",
      active: true,
    },
    {
      filename: "File G",
      tags: ["tag16", "tag17"],
      description: "This is file G",
      active: false,
    },
  ];

  messages = [
    {
      role: "system",
      content:
        "Welcome to our special place! We have lots of files with different interests. Let's begin by learning about them together.",
    },
    {
      role: "outgoing",
      content:
        "Yay, thank you so much for the warm welcome! I'm new here and I need some help to figure things out.",
    },
    {
      role: "incoming",
      content:
        "Of course, we're happy to help you. We have files with different tags that you can look at and explore.",
    },
    {
      role: "outgoing",
      content:
        "That sounds fun! How do I find files based on what I like or the tags?",
    },
    {
      role: "incoming",
      content:
        "Just type a tag you're interested in the search box and we'll show you all the matching files.",
    },
    {
      role: "outgoing",
      content:
        "I see! So, I just need to click on 'Search', type the tag I'm interested in, and press go. Is that right?",
    },
  ];
}
