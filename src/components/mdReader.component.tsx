import { Accessor, JSXElement, onMount, onCleanup, Setter } from "solid-js";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { ClipboardEntry } from "../types/clipboardEntry.interface";
import { ViewedFile } from "../types/viewedFile.interface";
import { storeViewedFile } from "../functions/storage.functions";
import { getFileContent } from "../functions/dbFilesInterface.functions";

export interface MdReaderProps {
  content: Accessor<string>;
  clipboard: Accessor<ClipboardEntry[]>;
  activeDirectoryName: Accessor<string | null>;
  setViewedFile: Setter<ViewedFile | null>;
}

export function MdReader(props: MdReaderProps): JSXElement {
  let containerRef: HTMLDivElement | undefined;

  const handleLinkClick = async (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (!href) return;

    // Skip external links (http://, https://, mailto:, etc.)
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return;

    e.preventDefault();

    // The href is the filename to look for
    const fileName = href;

    // First check clipboard
    const clipboardEntry = props.clipboard().find((c) => c.name() === fileName);
    if (clipboardEntry) {
      const viewedFile: ViewedFile = {
        source: "clipboard",
        directoryName: null,
        fileName,
      };
      props.setViewedFile(viewedFile);
      storeViewedFile(viewedFile);
      return;
    }

    // Then check active directory
    const activeDirName = props.activeDirectoryName();
    if (activeDirName) {
      const content = await getFileContent(activeDirName, fileName);
      if (content !== null) {
        const viewedFile: ViewedFile = {
          source: "idb",
          directoryName: activeDirName,
          fileName,
        };
        props.setViewedFile(viewedFile);
        storeViewedFile(viewedFile);
        return;
      }
    }

    // File not found - optionally could show a message or create a new file
    console.warn(`File not found: ${fileName}`);
  };

  onMount(() => {
    containerRef?.addEventListener("click", handleLinkClick);
  });

  onCleanup(() => {
    containerRef?.removeEventListener("click", handleLinkClick);
  });

  return (
    <div
      ref={containerRef}
      id="MARKDOWN_READER"
      innerHTML={micromark(props.content() ?? "", {
        extensions: [gfm()],
        htmlExtensions: [gfmHtml()],
      })}
    ></div>
  );
}
