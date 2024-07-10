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
      filename: 'File A',
      tags: ['#tag1', '#tag2'],
      description: 'This is file A',
      active: false
    },
    {
      filename: 'File B',
      tags: ['#tag3', '#tag4', '#tag5'],
      description: 'This is file B',
      active: true
    },
    {
      filename: 'File C',
      tags: ['#tag6', '#tag7'],
      description: 'This is file C',
      active: false
    },
    {
      filename: 'File D',
      tags: ['#tag8', '#tag9', '#tag10'],
      description: 'This is file D',
      active: true
    },
    {
      filename: 'File E',
      tags: ['#tag11', '#tag12'],
      description: 'This is file E',
      active: false
    },
    {
      filename: 'File F',
      tags: ['#tag13', '#tag14', '#tag15'],
      description: 'This is file F',
      active: true
    },
    {
      filename: 'File G',
      tags: ['#tag16', '#tag17'],
      description: 'This is file G',
      active: false
    },
    {
      filename: 'File H',
      tags: ['#tag18', '#tag19', '#tag20'],
      description: 'This is file H',
      active: true
    },
    {
      filename: 'File I',
      tags: ['#tag21', '#tag22'],
      description: 'This is file I',
      active: false
    },
    {
      filename: 'File J',
      tags: ['#tag23', '#tag24', '#tag25'],
      description: 'This is file J',
      active: true
    },
    {
      filename: 'File K',
      tags: ['#tag26', '#tag27'],
      description: 'This is file K',
      active: false
    },
    {
      filename: 'File L',
      tags: ['#tag28', '#tag29', '#tag30'],
      description: 'This is file L',
      active: true
    },
    {
      filename: 'File M',
       tags: ['#tag31', '#tag32'],
       description: 'This is file M',
       active: false
    },
    {
      filename: 'File N',
       tags: ['#tag33', '#tag34', '#tag35'],
       description: 'This is file N',
       active: true
    }
  ]
}