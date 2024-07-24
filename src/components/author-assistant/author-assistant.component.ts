import { Component, input } from "@angular/core";
import { FileListEntry } from "../../models/file-list-entry.model";
import { HttpRequest } from "@angular/common/http";
import { SimpleHttpRequest } from "../../models/simple-http-request.model";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "app-author-assistant",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./author-assistant.component.html",
  styleUrl: "./author-assistant.component.scss",
})
export class AuthorAssistantComponent {
  file = input.required<FileListEntry>();
  llm = input.required<SimpleHttpRequest>();
  public context: string = "";

  public readTokens: number = 4096;
  public writeTokens: number = 512;

  public seed: number = 0;
  public temperature: number = 0.5;
  public top_k: number = 1;

  private buildPrompt(): SimpleHttpRequest {
    return this.llm();
    throw new Error("NotImplemented");
  }
}
