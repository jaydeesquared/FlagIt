import { openDB, type DBSchema } from 'idb';

interface FlagItDB extends DBSchema {
  audio: {
    key: number;
    value: Blob;
  };
}

const DB_NAME = 'flagit-db';
const STORE_NAME = 'audio';

export async function initDB() {
  return openDB<FlagItDB>(DB_NAME, 2, {
    upgrade(db, oldVersion) {
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

export async function saveAudioBlob(id: number, blob: Blob) {
  const db = await initDB();
  await db.put(STORE_NAME, blob, id);
}

export async function getAudioBlob(id: number): Promise<Blob | undefined> {
  const db = await initDB();
  return await db.get(STORE_NAME, id);
}

export async function deleteAudioBlob(id: number) {
  const db = await initDB();
  await db.delete(STORE_NAME, id);
}
