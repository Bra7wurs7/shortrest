import { IDBPDatabase, openDB } from "idb";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import dayjs from "dayjs";

export async function createArchive(
  dbPromise: Promise<IDBPDatabase<unknown>>,
  name: string,
) {
  const db = await dbPromise;
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

export async function listArchives(dbPromise: Promise<IDBPDatabase<unknown>>) {
  const db = await dbPromise;
  const tx = db.transaction("archives", "readonly");
  const store = tx.objectStore("archives");
  return Array.from(await store.getAllKeys(), (key) => String(key));
}

export async function deleteArchive(
  dbPromise: Promise<IDBPDatabase<unknown>>,
  name: string,
) {
  const db = await dbPromise;
  const tx = db.transaction("archives", "readwrite");
  const store = tx.objectStore("archives");

  await store.delete(name);
  await tx.done;
}

export async function saveFileToArchive(
  dbPromise: Promise<IDBPDatabase<unknown>>,
  archiveName: string,
  fileName: string,
  fileContent: string | Blob,
) {
  if (typeof fileContent !== "string" && !(fileContent instanceof Blob)) {
    throw new Error(
      "Invalid file content type. Only strings or Blobs are allowed.",
    );
  }

  const db = await dbPromise;
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

export async function listFilesInArchive(
  dbPromise: Promise<IDBPDatabase<unknown>>,
  archiveName: string,
) {
  const db = await dbPromise;
  const tx = db.transaction("archives", "readonly");
  const store = tx.objectStore("archives");

  const archive = await store.get(archiveName);

  if (!archive) {
    throw new Error(`Archive named ${archiveName} does not exist`);
  }

  return Object.keys(archive.files);
}

export async function removeFileFromArchive(
  dbPromise: Promise<IDBPDatabase<unknown>>,
  archiveName: string,
  fileName: string,
) {
  const db = await dbPromise;
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

export async function getFileFromArchive(
  dbPromise: Promise<IDBPDatabase<unknown>>,
  archiveName: string,
  fileName: string,
) {
  const db = await dbPromise;
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

export async function downloadArchive(
  dbPromise: Promise<IDBPDatabase<unknown>>,
  archiveName: string,
) {
  const fileNames = await listFilesInArchive(dbPromise, archiveName);
  const zip = new JSZip();

  for (const fileName of fileNames) {
    const fileContent = await getFileFromArchive(
      dbPromise,
      archiveName,
      fileName,
    );
    zip.file(fileName, fileContent);
  }

  const content = await zip.generateAsync({ type: "blob" });
  const now = new Date();
  saveAs(
    content,
    `${archiveName} - ${dayjs().format("YYYY-MM-DD HH:mm:ss")}.zip`,
  );
}

export async function uploadArchive(
  dbPromise: Promise<IDBPDatabase<unknown>>,
  event: InputEvent,
) {
  const input = event.target;
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const archiveName = file.name.replace(".zip", "");
    await createArchive(dbPromise, archiveName);

    // Check if the uploaded file is a text file
    if (!file.type.match("text.*")) {
      throw new Error(`The file ${file.name} is not a text file`);
    }

    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);

    for (const fileName in zipContent.files) {
      if (!zipContent.files[fileName].dir) {
        const fileContent = await zipContent.files[fileName].async("blob");
        await saveFileToArchive(
          dbPromise,
          archiveName,
          fileName,
          await new Response(fileContent).text(),
        );
      }
    }
  }
}
