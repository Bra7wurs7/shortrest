import { TestBed } from '@angular/core/testing';

import { HttpClientWrapperService } from './http-client-wrapper.service';

describe('HttpClientWrapperService', () => {
  let service: HttpClientWrapperService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HttpClientWrapperService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
