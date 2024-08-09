import { CommonModule } from "@angular/common";
import { AfterViewInit, Component, ElementRef, ViewChild } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { FileListEntry } from "../models/file-list-entry.model";
import { FileListEntryComponent } from "../components/file-list-entry/file-list-entry.component";
import { HttpClient } from "@angular/common/http";
import { AuthorAssistantComponent } from "../components/author-assistant/author-assistant.component";
import { SimpleHttpRequest } from "../models/simple-http-request.model";
import { FormsModule } from "@angular/forms";
import { SystemAction } from "../models/system-action.model";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    FileListEntryComponent,
    AuthorAssistantComponent,
    FormsModule,
  ],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent implements AfterViewInit {
  title = "shortrest";

  public system_actions: SystemAction[] = [
    {
      name: "New File",
      description: "",
      icon: "iconoir-empty-page",
      command: "c",
      type: "create",
      action: (value) => {
        console.log(value);
      },
    },
    {
      name: "Read File",
      description: "",
      icon: "iconoir-page",
      command: "r",
      type: "read",
      action: (value) => {
        console.log(value);
      },
    },
    {
      name: "Edit File",
      description: "",
      icon: "iconoir-page-edit",
      command: "e",
      type: "edit",
      action: (value) => {
        console.log(value);
      },
    },
    {
      name: "Remove File",
      description: "",
      icon: "iconoir-bin-half",
      command: "rm",
      type: "delete",
      action: (value) => {
        console.log(value);
      },
    },
  ];

  defaultFile: FileListEntry = {
    filename: "default file",
    tags: [],
    content: "",
    active: true,
    reading: true,
    children: [],
  };

  ngAfterViewInit() {}

  llm: SimpleHttpRequest = {
    url: new URL("http://127.0.0.1:11434/v1/chat/completions"),
    method: "POST",
    headers: {},
    body: {},
    params: {},
  };

  files: FileListEntry[] = [
    {
      filename: "Flower",
      tags: ["Botanical", "Beautiful"],
      content: "A diverse and colorful plant structure",
      active: false,
      reading: false,
      children: [
        {
          filename: "Rose",
          tags: ["Fragrant", "Red", "White", "Pink"],
          content: "",
          active: false,
          reading: false,
          children: [],
        },
        {
          filename: "Tulip",
          tags: ["Colorful", "Spring"],
          content: "This is another variety of flower",
          active: false,
          children: [],
          reading: false,
        },
      ],
    },
    {
      filename: "Tree",
      tags: ["Botanical", "Natural"],
      content: "Tall and statelyy perennial plants",
      active: false,
      reading: false,
      children: [
        {
          filename: "Oak",
          tags: ["Strong", "Deciduous"],
          content: "",
          active: false,
          reading: false,
          children: [
            {
              filename: "Quercus robur",
              tags: ["Ubiquitous", "Common Oak"],
              content:
                "A common oak variety found across Europe and parts of Asia.",
              active: false,
              children: [],
              reading: false,
            },
            {
              filename: "Quercus alba",
              tags: ["White Oak", "North America"],
              content:
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
          content: "This is another variety of tree",
          active: false,
          reading: false,
          children: [
            {
              filename: "Red Maple",
              tags: ["Autumn colors", "Northern"],
              content: "",
              active: false,
              children: [],
              reading: false,
            },
            {
              filename: "Sugar Maple",
              tags: ["Sugar", "Syrup"],
              content: "Known for its sweet syrup production",
              active: false,
              children: [],
              reading: false,
            },
          ],
        },
        {
          filename: "Apple",
          tags: ["Rosaceae", "Fruit"],
          content: "Juicy fruit common in temperate climates",
          active: false,
          reading: false,
          children: [
            {
              filename: "Granny Smith",
              tags: ["Green", "Sour"],
              content: "",
              active: false,
              children: [],
              reading: false,
            },
            {
              filename: "Fuji",
              tags: ["Crisp", "Juicy"],
              content: "A variety of apple with a sweet and crisp taste.",
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
      content: "Feathered creatures that fly and chirp",
      active: false,
      reading: false,
      children: [
        {
          filename: "Sparrow",
          tags: ["Small", "Common"],
          content: "",
          active: false,
          children: [],
          reading: false,
        },
        {
          filename: "Eagle",
          tags: ["Large", "Powerful"],
          content: "Majestic birds of prey known for their sight and strength",
          active: false,
          children: [],
          reading: false,
        },
      ],
    },
    {
      filename: "Mammal",
      tags: ["Warm-blooded", "Animal"],
      content:
        "A group of vertebrate animals that are characterized by their ability to regulate body temperature and give live birth to their young ones.",
      active: false,
      reading: false,
      children: [
        {
          filename: "Dog",
          tags: ["Pet", "Loyal"],
          content: "",
          active: false,
          children: [],
          reading: false,
        },
        {
          filename: "Whale",
          tags: ["Large", "Marine Mammal"],
          content: "The largest animals on Earth that live in the oceans.",
          active: false,
          children: [],
          reading: false,
        },
      ],
    },
  ];
}
