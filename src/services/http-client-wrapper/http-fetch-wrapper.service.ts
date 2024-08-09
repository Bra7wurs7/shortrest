import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable, map } from "rxjs";
import { SimpleHttpRequest } from "../../models/simple-http-request.model";

@Injectable({
  providedIn: "root",
})
export class HttpFetchWrapperService {
  constructor() {}

  public async streamPrompt(
    request: SimpleHttpRequest,
  ): Promise<Observable<Record<string, any>[]> | undefined> {
    const response = await fetch(
      request.url + this.httpParamsToStringSuffix(request.params),
      {
        method: "POST",
        headers: { ...request.headers, "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
      },
    );

    const reader = response.body
      ?.pipeThrough(new TextDecoderStream())
      .getReader();

    if (reader) {
      return this.readableStreamToObservable(reader).pipe(
        map((a) => this.tolerantJsonParse(a)),
      );
    } else {
      return;
    }
  }

  /**
   * Converts a record of http params into a string to be appended to any url
   * @param params An instance of Record<string, string> to be converted into a string suffix
   * @returns A string of http parameters that can be appended to any url
   */
  public httpParamsToStringSuffix(params: Record<string, string>): string {
    const paramEntries = Object.entries(params);
    const paramString = paramEntries
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
      )
      .join("&");
    return paramString ? `?${paramString}` : "";
  }

  /**
   * Convert a ReadableStream into an Observable<string>. This method is useful for handling server-sent events or any other stream of data that can be read as text.
   *
   * @param reader - The ReadableStreamDefaultReader to convert into an Observable. It should have been created with `stream.getReader()`.
   *
   * @returns An Observable that emits each string value from the input stream, and then completes when the stream is done. If there are any errors during the reading process, they will be emitted as errors on the Observable.
   */
  public readableStreamToObservable(
    reader: ReadableStreamDefaultReader<string>,
  ): Observable<string> {
    return new Observable<string>((subscriber) => {
      // Recursive function to read the stream
      const pump = () => {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              // Close the stream if it's done
              subscriber.complete();
              return;
            }
            // Emit the value and continue reading
            subscriber.next(value);
            pump();
          })
          .catch((err) => {
            // Handle any errors
            subscriber.error(err);
          });
      };

      // Start the reading process
      pump();

      // Return a teardown logic function
      return () => {
        reader.cancel().catch(() => {
          // Handle the cancel error if necessary
        });
      };
    });
  }

  /**
   * This method attempts to parse a string as a list of JSON objects, even if the string contains invalid or non-JSON data.
   * It uses a regular expression to extract potential JSON objects from the input string and then attempts to parse them.
   * If parsing fails for a given substring, that substring is considered not to be a valid JSON object and is ignored.
   *
   * @param input - The string to parse as a list of JSON objects. It can contain invalid or non-JSON data.
   *
   * @returns An array of the successfully parsed JSON objects from the input string. If no valid JSON objects are found, an empty array is returned.
   */
  public tolerantJsonParse(input: string): Record<string, any>[] {
    // Regular expression to match JSON objects
    const jsonRegex = /{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/g;
    const validJsonObjects: Record<string, any>[] = [];
    let match: RegExpExecArray | null;

    // Iterate over all matches of the regular expression
    while ((match = jsonRegex.exec(input)) !== null) {
      try {
        // Attempt to parse the matched string as JSON
        const jsonObject = JSON.parse(match[0]);
        validJsonObjects.push(jsonObject);
      } catch (error) {
        // If parsing fails, it's not a valid JSON object, so we ignore it
      }
    }

    return validJsonObjects;
  }
}
