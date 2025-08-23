import { IDBPDatabase, openDB } from "idb";
import { BasicFile } from "../types/basicFile.interface";
import { Directory } from "../types/directory.interface";

const dbPromise = openDB("shortrest", 1, {
  upgrade(db: IDBPDatabase<"shortrest">) {
    // Create object stores for directories and files
    const dirsStore = db.createObjectStore("directories", { keyPath: "name" });
    const filesStore = db.createObjectStore("files", {
      keyPath: ["dirName", "fileName"],
    });

    // Create indexes to make querying more efficient
    filesStore.createIndex("dirName", "dirName");
  },
});

// List all directories stored in the IDB, with empty directories at the start
export async function listAllDirectories(): Promise<string[]> {
  const db = await dbPromise;
  const dirs = await db.getAll("directories");

  // Fetch file counts for each directory
  const dirNamePromises = dirs.map(async (d: Directory) => {
    const transaction = db.transaction(["files"], "readonly");
    const store = transaction.objectStore("files");
    const index = store.index("dirName");
    const files = await index.getAll(IDBKeyRange.only(d.name));
    return { name: d.name, fileCount: files.length };
  });

  // Wait for all promises to resolve
  const dirsWithCounts = await Promise.all(dirNamePromises);

  // Separate empty directories from non-empty ones
  const emptyDirs = dirsWithCounts
    .filter((d) => d.fileCount === 0)
    .map((d) => d.name);
  const nonEmptyDirs = dirsWithCounts
    .filter((d) => d.fileCount > 0)
    .map((d) => d.name);

  // Combine lists with empty directories first
  return [...emptyDirs, ...nonEmptyDirs];
}

// Add a new directory to the database (if it doesn't already exist)
export async function addDirectory(dirName: string): Promise<void> {
  const db = await dbPromise;

  // Check if the directory exists, if not, create it
  const existingDir = await db.get("directories", dirName);
  if (!existingDir) {
    const newDir = { name: dirName };
    await db.add("directories", newDir);
  }
}

// List the names of all files contained inside the directory with the given name
export async function listFileNamesInDirectory(
  dirName: string,
): Promise<string[]> {
  const db = await dbPromise;
  const transaction = db.transaction(["files"], "readonly");
  const store = transaction.objectStore("files");
  const index = store.index("dirName");
  const files = await index.getAll(IDBKeyRange.only(dirName));
  return files.map((f) => f.fileName);
}

// Get the content of a file from a directory
export async function getFileContent(
  dirName: string,
  fileName: string,
): Promise<string | null> {
  const db = await dbPromise;
  const file = await db.get("files", [dirName, fileName]);
  return file ? file.content : null;
}

// Write (overwrite) a file to a directory
export async function writeFileToDirectory(
  dirName: string,
  file: BasicFile,
): Promise<void> {
  // Ensure the directory exists
  let directory = await dbPromise.then((db) => db.get("directories", dirName));
  if (!directory) {
    const db = await dbPromise;
    directory = { name: dirName, files: [], setFiles: [] };
    await db.add("directories", directory);
  }

  // Add or update the file in the database
  const db = await dbPromise;
  await db.put("files", {
    dirName: dirName,
    fileName: file.name,
    content: file.content,
  });
}

// Remove a file from a directory
export async function removeFileFromDirectory(
  dirName: string,
  fileName: string,
): Promise<void> {
  const db = await dbPromise;
  return db.delete("files", [dirName, fileName]);
}

// Remove a whole directory (and all its files)
export async function removeDirectory(dirName: string): Promise<void> {
  const db = await dbPromise;

  // First delete all files in the directory
  const transaction = db.transaction(["files"], "readwrite");
  const store = transaction.objectStore("files");
  const index = store.index("dirName");
  const files = await index.getAll(IDBKeyRange.only(dirName));
  for (const file of files) {
    await store.delete([file.dirName, file.fileName]);
  }

  // Then delete the directory itself
  return db.delete("directories", dirName);
}

// Function to get the amount of files contained in a directory
export async function countFilesInDirectory(dirName: string): Promise<number> {
  const db = await dbPromise;
  const transaction = db.transaction(["files"], "readonly");
  const store = transaction.objectStore("files");
  const index = store.index("dirName");

  // Get all files in the directory using the dirName index
  const files = await index.getAll(IDBKeyRange.only(dirName));

  // Return the count of files found in that directory
  return files.length;
}
