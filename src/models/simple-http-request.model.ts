export interface SimpleHttpRequest {
  url: URL;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  headers: Record<string, string>;
  body: Record<string, any>;
  params: Record<string, string>;
}
