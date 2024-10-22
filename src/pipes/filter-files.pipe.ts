import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: "filterFiles",
  standalone: true,
})
export class FilterFilesPipe implements PipeTransform {
  transform(value: string[], ...args: string[]): string[] {
    return value.filter((s) =>
      s.toLowerCase().includes(args[0].toLowerCase() ?? ""),
    );
  }
}
