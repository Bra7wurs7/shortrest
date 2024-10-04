import { Injectable } from '@angular/core';
import { openDB } from 'idb';
import { FileContent } from '../../models/file-content.model';

@Injectable({
  providedIn: 'root',
})
export class FilesService {
  private dbPromise;

  constructor() {
    this.dbPromise = openDB('filesDb', 1, {
      upgrade(database) {
        database.createObjectStore('archives');
      },
    });
  }

  /**
   * Creates a new archive with the given name and returns its unique ID.
   *
   * @param {string} name - The name of the new archive.
   * @returns {Promise<string>} A promise that resolves to the unique ID of the created archive.
   */
  async createArchive(name: string): Promise<string> {
    const db = await this.dbPromise;
    const tx = db.transaction('archives', 'readwrite');
    const store = tx.objectStore('archives');
    const id = self.crypto.randomUUID(); // generates a random unique id for the archive
    await store.put({ files: {} }, id);
    await tx.done;
    return id;
  }

  /**
   * Retrieves all archives from indexedDB.
   *
   * @returns {Promise<Array<string>>} A promise that resolves to an array of archive IDs as strings.
   */
  async listArchives(): Promise<string[]> {
    const db = await this.dbPromise;
    const tx = db.transaction('archives', 'readonly');
    const store = tx.objectStore('archives');
    return Array.from(await store.getAllKeys(), (key) => String(key)); // returns all keys (ids) of the archives as strings
  }

  /**
   * Deletes an archive from indexedDB by its unique ID.
   *
   * @param {string} id - The unique ID of the archive to delete.
   */
  async deleteArchive(id: string): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction('archives', 'readwrite');
    const store = tx.objectStore('archives');
    await store.delete(id); // deletes the archive with given id
    await tx.done;
  }

  /**
   * Adds a file into an existing archive by its id and filename
   * @param {string} archiveId - The unique ID of the target archive.
   * @param {string} fileName - The name of the file to add.
   * @param {FileContent} fileContent - The content of the file to add.
   */
  async addFileToArchive(
    archiveId: string,
    fileName: string,
    fileContent: FileContent
  ): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction('archives', 'readwrite');
    const store = tx.objectStore('archives');
    const archive = await store.get(archiveId); // gets the archive with given id
    if (!archive) {
      throw new Error(`Archive with id ${archiveId} does not exist`);
    }
    archive.files[fileName] = fileContent; // adds the file into the archive's files map
    await store.put(archive, archiveId); // updates the archive in indexedDB
    await tx.done;
  }

  /**
   * Lists all files inside an archive by its unique ID.
   * If the archive does not exist, throws an error.
   *
   * @param {string} archiveId - The unique ID of the target archive.
   * @returns {Promise<Array<string>>} A promise that resolves to an array of filenames inside the specified archive as strings.
   * @throws Will throw an error if the archive with the given id does not exist in indexedDB.
   */
  async listFilesInArchive(archiveId: string): Promise<string[]> {
    const db = await this.dbPromise;
    const tx = db.transaction('archives', 'readonly');
    const store = tx.objectStore('archives');
    const archive = await store.get(archiveId); // gets the archive with given id
    if (!archive) {
      throw new Error(`Archive with id ${archiveId} does not exist`);
    }
    return Object.keys(archive.files); // returns all file names in the archive's files map as an array of strings
  }

  /**
   * Removes a specific file from an existing archive by its unique ID and filename.
   * If the archive or the specified file do not exist, throws an error.
   *
   * @param {string} archiveId - The unique ID of the target archive.
   * @param {string} fileName - The name of the file to remove from the archive.
   * @throws Will throw an error if the archive with the given id does not exist in indexedDB or if the specified file does not exist in the archive's files map.
   */
  async removeFileFromArchive(
    archiveId: string,
    fileName: string
  ): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction('archives', 'readwrite');
    const store = tx.objectStore('archives');
    const archive = await store.get(archiveId); // gets the archive with given id
    if (!archive) {
      throw new Error(`Archive with id ${archiveId} does not exist`);
    }
    if (!(fileName in archive.files)) {
      throw new Error(
        `File with name ${fileName} does not exist in archive with id ${archiveId}`
      );
    }
    delete archive.files[fileName]; // removes the file from the archive's files map
    await store.put(archive, archiveId); // updates the archive in indexedDB
    await tx.done;
  }
}
