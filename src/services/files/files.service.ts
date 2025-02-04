import { Injectable } from "@angular/core";
import { openDB } from "idb";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { formatDate } from "@angular/common";

@Injectable({
  providedIn: "root",
})
export class FilesService {
  private dbPromise;

  constructor() {
    this.dbPromise = openDB("filesDb", 1, {
      upgrade(database) {
        database.createObjectStore("archives");
      },
    });
  }

  async createArchive(name: string): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction("archives", "readonly");
    const store = tx.objectStore("archives");
    if (await store.getKey(name)) {
      throw new Error(`Archive named ${name} already exists`);
    }
    await tx.done;
    const writeTx = db.transaction("archives", "readwrite");
    const writeStore = writeTx.objectStore("archives");
    await writeStore.put({ files: {} }, name);
    await writeTx.done;
  }

  async listArchives(): Promise<string[]> {
    const db = await this.dbPromise;
    const tx = db.transaction("archives", "readonly");
    const store = tx.objectStore("archives");
    return Array.from(await store.getAllKeys(), (key) => String(key));
  }

  async deleteArchive(name: string): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction("archives", "readwrite");
    const store = tx.objectStore("archives");
    await store.delete(name);
    await tx.done;
  }

  async saveFileToArchive(
    archiveName: string,
    fileName: string,
    fileContent: string | Blob,
  ): Promise<void> {
    if (typeof fileContent !== "string" && !(fileContent instanceof Blob)) {
      throw new Error(
        "Invalid file content type. Only strings or Blobs are allowed.",
      );
    }
    const db = await this.dbPromise;
    const tx = db.transaction("archives", "readwrite");
    const store = tx.objectStore("archives");
    let archive = await store.get(archiveName);
    if (!archive) {
      throw new Error(`Archive named ${archiveName} does not exist`);
    }
    archive.files[fileName] = fileContent;
    await store.put(archive, archiveName);
    await tx.done;
  }

  async listFilesInArchive(archiveName: string): Promise<string[]> {
    const db = await this.dbPromise;
    const tx = db.transaction("archives", "readonly");
    const store = tx.objectStore("archives");
    const archive = await store.get(archiveName);
    if (!archive) {
      throw new Error(`Archive named ${archiveName} does not exist`);
    }
    return Object.keys(archive.files);
  }

  async removeFileFromArchive(
    archiveName: string,
    fileName: string,
  ): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction("archives", "readwrite");
    const store = tx.objectStore("archives");
    let archive = await store.get(archiveName);
    if (!archive) {
      throw new Error(`Archive named ${archiveName} does not exist`);
    }
    if (!(fileName in archive.files)) {
      throw new Error(
        `File with name ${fileName} does not exist in archive named ${archiveName}`,
      );
    }
    delete archive.files[fileName];
    await store.put(archive, archiveName);
    await tx.done;
  }

  async getFileFromArchive(
    archiveName: string,
    fileName: string,
  ): Promise<string | Blob> {
    const db = await this.dbPromise;
    const tx = db.transaction("archives", "readonly");
    const store = tx.objectStore("archives");
    const archive = await store.get(archiveName);
    if (!archive) {
      throw new Error(`Archive named ${archiveName} does not exist`);
    }
    if (!(fileName in archive.files)) {
      throw new Error(
        `File with name ${fileName} does not exist in archive named ${archiveName}`,
      );
    }
    return archive.files[fileName];
  }

  async downloadArchive(archiveName: string): Promise<void> {
    const fileNames = await this.listFilesInArchive(archiveName);
    const zip = new JSZip();

    for (const fileName of fileNames) {
      const fileContent = await this.getFileFromArchive(archiveName, fileName);
      zip.file(fileName, fileContent);
    }

    const content = await zip.generateAsync({ type: "blob" });
    const now = new Date();
    saveAs(
      content,
      `${archiveName} - ${formatDate(now, "short", navigator.language)}.zip`,
    );
  }

  async uploadArchive(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const archiveName = file.name.replace(".zip", "");
      await this.createArchive(archiveName);

      // Check if the uploaded file is a text file
      if (!file.type.match("text.*")) {
        throw new Error(`The file ${file.name} is not a text file`);
      }

      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);

      for (const fileName in zipContent.files) {
        if (!zipContent.files[fileName].dir) {
          const fileContent = await zipContent.files[fileName].async("blob");
          await this.saveFileToArchive(
            archiveName,
            fileName,
            await new Response(fileContent).text(),
          );
        }
      }
    }
  }
}
