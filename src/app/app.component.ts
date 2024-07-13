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
      filename: "Flower",
      tags: ["Botanical", "Beautiful"],
      description: "A diverse and colorful plant structure",
      active: true,
      children: [
        {
          filename: "Rose",
          tags: ["Fragrant", "Red", "White", "Pink"],
          description: "",
          active: false,
          children: [],
        },
        {
          filename: "Tulip",
          tags: ["Colorful", "Spring"],
          description: "This is another variety of flower",
          active: false,
          children: [],
        },
      ],
    },
    {
      filename: "Tree",
      tags: ["Botanical", "Natural"],
      description: "Tall and statelyy perennial plants",
      active: true,
      children: [
        {
          filename: "Oak",
          tags: ["Strong", "Deciduous"],
          description: "",
          active: false,
          children: [],
        },
        {
          filename: "Maple",
          tags: ["Autumn colors", "Sugar"],
          description: "This is another variety of tree",
          active: false,
          children: [],
        },
        {
          filename: "Apple",
          tags: ["Rosaceae", "Fruit"],
          description: "Juicy fruit common in temperate climates",
          active: false,
          children: [
            {
              filename: "Granny Smith",
              tags: ["Green", "Sour"],
              description: "",
              active: false,
              children: [],
            },
            {
              filename: "Fuji",
              tags: ["Crisp", "Juicy"],
              description: "A variety of apple with a sweet and crisp taste.",
              active: false,
              children: [],
            },
          ],
        },
      ],
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
