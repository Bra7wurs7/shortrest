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
      active: false,
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
      active: false,
      children: [
        {
          filename: "Oak",
          tags: ["Strong", "Deciduous"],
          description: "",
          active: false,
          children: [
            {
              filename: "Quercus robur",
              tags: ["Ubiquitous", "Common Oak"],
              description:
                "A common oak variety found across Europe and parts of Asia.",
              active: false,
              children: [],
            },
            {
              filename: "Quercus alba",
              tags: ["White Oak", "North America"],
              description:
                "This white oak variant is native to North America and has a wide distribution range.",
              active: false,
              children: [],
            },
          ],
        },
        {
          filename: "Maple",
          tags: ["Autumn colors", "Sugar"],
          description: "This is another variety of tree",
          active: false,
          children: [
            {
              filename: "Red Maple",
              tags: ["Autumn colors", "Northern"],
              description: "",
              active: false,
              children: [],
            },
            {
              filename: "Sugar Maple",
              tags: ["Sugar", "Syrup"],
              description: "Known for its sweet syrup production",
              active: false,
              children: [],
            },
          ],
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
    {
      filename: "Bird",
      tags: ["Aviary", "Wildlife"],
      description: "Feathered creatures that fly and chirp",
      active: false,
      children: [
        {
          filename: "Sparrow",
          tags: ["Small", "Common"],
          description: "",
          active: false,
          children: [],
        },
        {
          filename: "Eagle",
          tags: ["Large", "Powerful"],
          description:
            "Majestic birds of prey known for their sight and strength",
          active: false,
          children: [],
        },
      ],
    },
    {
      filename: "Mammal",
      tags: ["Warm-blooded", "Animal"],
      description:
        "A group of vertebrate animals that are characterized by their ability to regulate body temperature and give live birth to their young ones.",
      active: false,
      children: [
        {
          filename: "Dog",
          tags: ["Pet", "Loyal"],
          description: "",
          active: false,
          children: [],
        },
        {
          filename: "Whale",
          tags: ["Large", "Marine Mammal"],
          description: "The largest animals on Earth that live in the oceans.",
          active: false,
          children: [],
        },
      ],
    },
  ];
}
