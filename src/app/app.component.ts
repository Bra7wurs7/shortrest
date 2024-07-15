import { CommonModule } from "@angular/common";
import { AfterViewInit, Component, ElementRef, ViewChild } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { fileListEntry } from "../models/file-list-entry.model";
import { FileListEntryComponent } from "../components/file-list-entry/file-list-entry.component";
import { defaultValueCtx, Editor, rootCtx } from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { nord } from "@milkdown/theme-nord";
import { HttpClient } from "@angular/common/http";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, CommonModule, FileListEntryComponent],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent implements AfterViewInit {
  @ViewChild("editorRef") editorRef!: ElementRef;

  title = "shortrest";
  defaultValue = "";

  constructor(private readonly http: HttpClient) {
    this.http
      .get("https://jaspervdj.be/lorem-markdownum/markdown.txt", {
        responseType: "text",
      })
      .subscribe((data: string) => {
        this.defaultValue = data;
        Editor.make()
          .config((ctx) => {
            ctx.set(rootCtx, this.editorRef.nativeElement);
            ctx.set(defaultValueCtx, this.defaultValue);
          })
          .config(nord)
          .use(commonmark)
          .create();
      });
  }

  ngAfterViewInit() {}

  files: fileListEntry[] = [
    {
      filename: "Flower",
      tags: ["Botanical", "Beautiful"],
      description: "A diverse and colorful plant structure",
      active: false,
      reading: false,
      children: [
        {
          filename: "Rose",
          tags: ["Fragrant", "Red", "White", "Pink"],
          description: "",
          active: false,
          reading: false,
          children: [],
        },
        {
          filename: "Tulip",
          tags: ["Colorful", "Spring"],
          description: "This is another variety of flower",
          active: false,
          children: [],
          reading: false,
        },
      ],
    },
    {
      filename: "Tree",
      tags: ["Botanical", "Natural"],
      description: "Tall and statelyy perennial plants",
      active: false,
      reading: false,
      children: [
        {
          filename: "Oak",
          tags: ["Strong", "Deciduous"],
          description: "",
          active: false,
          reading: false,
          children: [
            {
              filename: "Quercus robur",
              tags: ["Ubiquitous", "Common Oak"],
              description:
                "A common oak variety found across Europe and parts of Asia.",
              active: false,
              children: [],
              reading: false,
            },
            {
              filename: "Quercus alba",
              tags: ["White Oak", "North America"],
              description:
                "This white oak variant is native to North America and has a wide distribution range.",
              active: false,
              children: [],
              reading: false,
            },
          ],
        },
        {
          filename: "Maple",
          tags: ["Autumn colors", "Sugar"],
          description: "This is another variety of tree",
          active: false,
          reading: false,
          children: [
            {
              filename: "Red Maple",
              tags: ["Autumn colors", "Northern"],
              description: "",
              active: false,
              children: [],
              reading: false,
            },
            {
              filename: "Sugar Maple",
              tags: ["Sugar", "Syrup"],
              description: "Known for its sweet syrup production",
              active: false,
              children: [],
              reading: false,
            },
          ],
        },
        {
          filename: "Apple",
          tags: ["Rosaceae", "Fruit"],
          description: "Juicy fruit common in temperate climates",
          active: false,
          reading: false,
          children: [
            {
              filename: "Granny Smith",
              tags: ["Green", "Sour"],
              description: "",
              active: false,
              children: [],
              reading: false,
            },
            {
              filename: "Fuji",
              tags: ["Crisp", "Juicy"],
              description: "A variety of apple with a sweet and crisp taste.",
              active: false,
              children: [],
              reading: false,
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
      reading: false,
      children: [
        {
          filename: "Sparrow",
          tags: ["Small", "Common"],
          description: "",
          active: false,
          children: [],
          reading: false,
        },
        {
          filename: "Eagle",
          tags: ["Large", "Powerful"],
          description:
            "Majestic birds of prey known for their sight and strength",
          active: false,
          children: [],
          reading: false,
        },
      ],
    },
    {
      filename: "Mammal",
      tags: ["Warm-blooded", "Animal"],
      description:
        "A group of vertebrate animals that are characterized by their ability to regulate body temperature and give live birth to their young ones.",
      active: false,
      reading: false,
      children: [
        {
          filename: "Dog",
          tags: ["Pet", "Loyal"],
          description: "",
          active: false,
          children: [],
          reading: false,
        },
        {
          filename: "Whale",
          tags: ["Large", "Marine Mammal"],
          description: "The largest animals on Earth that live in the oceans.",
          active: false,
          children: [],
          reading: false,
        },
      ],
    },
  ];
}
