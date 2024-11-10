import { TestBed } from "@angular/core/testing";

import { HttpFetchWrapperService } from "./http-fetch-wrapper.service";

describe("HttpClientWrapperService", () => {
  let service: HttpFetchWrapperService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HttpFetchWrapperService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });
});
