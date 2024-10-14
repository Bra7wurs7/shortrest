import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  inject,
  OnInit,
  Signal,
  signal,
  viewChild,
  ViewChild,
  WritableSignal,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthorAssistantComponent } from '../components/author-assistant/author-assistant.component';
import { SimpleHttpRequest } from '../models/simple-http-request.model';
import { FormsModule } from '@angular/forms';
import { SystemAction } from '../models/system-action.model';
import { FileListComponent } from '../components/file-list/file-list.component';
import { FileContent } from '../models/file-content.model';
import { FilesService } from '../services/files/files.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    AuthorAssistantComponent,
    FormsModule,
    FileListComponent,
  ],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  @ViewChild('rightSidebar') rightSidebar!: AuthorAssistantComponent;
  @ViewChild('controlBar') control_bar!: ElementRef<HTMLInputElement>;

  filesService = inject(FilesService);

  title = 'shortrest';

  activeArchiveName: WritableSignal<string> = signal('Unnamed Archive');
  activeArchiveFiles: Signal<Promise<string[]>> = computed(() => this.filesService.listFilesInArchive(this.activeArchiveName()));

  activeFileName: string = '';
  activeFile: string | Blob = '';

  protected system_actions: SystemAction[] = [
    {
      visibleRegex: new RegExp(''),
      name: 'Show File',
      advice: 'Enter the name of the file to show',
      icon: 'iconoir-page',
      command: 's',
      color: 'blue',
      action: (value: HTMLInputElement) => {},
      highlighted: signal(false),
    },
    {
      visibleRegex: new RegExp('.*'),
      name: 'New File',
      advice: 'Enter a name for the new file',
      icon: 'iconoir-empty-page',
      command: 'n',
      color: 'green',
      action: (value: HTMLInputElement) => {},
      highlighted: signal(false),
    },
    {
      visibleRegex: new RegExp(''),
      name: 'Save File',
      advice: 'Enter a name under which to save the current file',
      icon: 'iconoir-page-edit',
      command: 'e',
      color: 'yellow',
      action: (value: HTMLInputElement) => {},
      highlighted: signal(false),
    },
    {
      visibleRegex: new RegExp(''),
      name: 'Remove File',
      advice: 'Enter the name of the file you want to delete',
      icon: 'iconoir-bin-half',
      command: 'r',
      color: 'red',
      action: (value: HTMLInputElement) => {},
      highlighted: signal(false),
    },
    {
      visibleRegex: new RegExp('.*'),
      name: 'Add to prompt',
      advice:
        'Adds information from the named file to the right sidebar, for the AI to read',
      icon: 'iconoir-bonfire',
      command: 'x',
      color: 'fire',
      action: (value: HTMLInputElement) => {},
      highlighted: signal(false),
    },
  ];

  highlightedSystemAction = computed(() =>
    this.system_actions.find((sa) => {
      return sa.highlighted();
    })
  );

  highlightedSystemActionIndex = computed(() =>
    this.system_actions.findIndex((sa) => {
      return sa.highlighted();
    })
  );

  llm: SimpleHttpRequest = {
    url: new URL('http://127.0.0.1:11434/v1/chat/completions'),
    method: 'POST',
    headers: {},
    body: {},
    params: {},
  };

  ngOnInit(): void {}

  /**
   * Triggered whenever the right sidebar emits a string token
   * @param token the token emitted. '' marks the end of a sequence
   */
  onToken(token: string) {
    if (token === '') {
      this.saveActiveArchive();
    } else {
      this.activeFile += token;
    }
  }

  systemActionOnClick(
    system_action: SystemAction,
    control_bar: HTMLInputElement
  ) {
    system_action.action(control_bar);
  }

  systemBarOnKeyDown(e: KeyboardEvent) {
    const action = this.highlightedSystemAction();
    const index = this.highlightedSystemActionIndex();
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (index !== -1) {
          const newIndex = index - 1;
          this.system_actions[index].highlighted.set(false);
          if (newIndex >= 0)
            this.system_actions[newIndex].highlighted.set(true);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        const newIndex = index + 1;
        if (index !== -1) {
          this.system_actions[index].highlighted.set(false);
        }
        if (newIndex < this.system_actions.length) {
          this.system_actions[newIndex].highlighted.set(true);
        }
        break;
      case 'Enter':
        if (e.ctrlKey) {
          this.rightSidebar.buildPrompt();
        }
        if (action) {
          action.action(this.control_bar.nativeElement);
          //this.control_bar.nativeElement.value = "";
        }
        break;
      case 'Backspace':
        if (this.control_bar.nativeElement.value === '' && action) {
          action.highlighted.set(false);
        }
        break;
    }
  }

  systemBarOnKeyUp(e: KeyboardEvent) {
    const action = this.highlightedSystemAction();
    const index = this.highlightedSystemActionIndex();
    switch (e.key) {
      case ' ':
        if (this.highlightedSystemAction() === undefined) {
          const command = this.control_bar.nativeElement.value.split(' ')[0];
          const command_action = this.system_actions.find(
            (sa) => sa.command === command
          );
          if (command_action) {
            command_action.highlighted.set(true);
            this.control_bar.nativeElement.value =
              this.control_bar.nativeElement.value.replace(command + ' ', '');
          }
        }
        break;
    }
  }

  textInputOnKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case 'Enter':
        if (e.ctrlKey) {
          this.rightSidebar.buildPrompt();
        }
        break;
    }
  }

  async saveActiveArchive() {
    return;
  }

  newFile(fileName: string = 'nameless file') {
    // @TODO Add save check for current file
    this.activeFileName = fileName;
    this.activeFile = '';
  }

  removeFile(fileName: string) {
    this.filesService.removeFileFromArchive(this.activeArchiveName(), fileName);
  }

  openFile(fileName: string) {
    // @TODO Add save check for current file
    this.activeFileName = fileName;
    this.filesService
      .getFileFromArchive(this.activeArchiveName(), fileName)
      .then((fileContent) => (this.activeFile = fileContent));
  }

  saveFile(fileName: string) {
    // @TODO add same fileName Check
    this.filesService.saveFileToArchive(this.activeArchiveName(), fileName, this.activeFile);
  }

  deepCopy<A>(obj: A): A {
    return JSON.parse(JSON.stringify(obj));
  }

  scrollIncrementDecrement(
    invert: boolean,
    e: WheelEvent,
    n: number,
    step: number = 1,
    max: number = 100,
    min: number = 0
  ): number {
    if (invert ? e.deltaY > 0 : e.deltaY < 0) {
      if (n - step >= min) {
        return n - step;
      }
    } else {
      if (n + step <= max) {
        return n + step;
      }
    }
    return n;
  }
}
