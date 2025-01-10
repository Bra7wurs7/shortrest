import { ApplicationConfig } from "@angular/core";
import { Routes } from "@angular/router";
import { provideRouter } from "@angular/router";
import { provideHttpClient } from "@angular/common/http";

export const routes: Routes = [];

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideHttpClient()],
};
