import { ComponentFixture, TestBed } from "@angular/core/testing";
import { AuthorAssistantComponent } from "../src/components/author-assistant.component";

describe("AuthorAssistantComponent", () => {
  let component: AuthorAssistantComponent;
  let fixture: ComponentFixture<AuthorAssistantComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthorAssistantComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthorAssistantComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
