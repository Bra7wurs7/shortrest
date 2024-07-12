import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileListEntryComponent } from './file-list-entry.component';

describe('FileListEntryComponent', () => {
  let component: FileListEntryComponent;
  let fixture: ComponentFixture<FileListEntryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileListEntryComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FileListEntryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
