import { db } from "./db";
import { DatabaseStorage } from "./database-storage";
import { FileStorage } from "./file-storage";
import type { IStorage } from "./storage-interface";

export type { IStorage } from "./storage-interface";

export const storage: IStorage =
  db !== null ? new DatabaseStorage() : new FileStorage();
