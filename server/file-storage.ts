import fs from "fs";
import path from "path";
import type {
  Recording,
  RecordingWithFlags,
  Flag,
  Category,
  InsertRecording,
  UpdateRecordingRequest,
  InsertFlag,
  UpdateFlagRequest,
  InsertCategory,
} from "@shared/schema";

type RecordingRow = Recording;
type FlagRow = Flag;
type CategoryRow = Category;

interface Store {
  nextRecordingId: number;
  nextFlagId: number;
  nextCategoryId: number;
  recordings: RecordingRow[];
  flags: FlagRow[];
  categories: CategoryRow[];
}

const defaultStore: Store = {
  nextRecordingId: 1,
  nextFlagId: 1,
  nextCategoryId: 1,
  recordings: [],  // Correct: starts empty
  flags: [],       // Correct: starts empty
  categories: [],  // Correct: starts empty
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function loadStore(): Store {
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Store>;
    const store = { ...defaultStore, ...parsed } as Store;
    store.recordings = (store.recordings ?? []).map((r: any) => ({
      ...r,
      createdAt: toDate(r.createdAt),
    }));
    return store;
  } catch {
    return { ...defaultStore };
  }
}

function saveStore(store: Store): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("[file-storage] Failed to write store:", err);
  }
}

export class FileStorage {
  private store: Store;

  constructor() {
    this.store = loadStore();
  }

  private persist(): void {
    saveStore(this.store);
  }

  async getCategories(): Promise<Category[]> {
    return [...this.store.categories];
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const id = this.store.nextCategoryId++;
    const row: CategoryRow = {
      id,
      name: category.name,
      color: category.color ?? "gray",
    };
    this.store.categories.push(row);
    this.persist();
    return row;
  }

  async deleteCategory(id: number): Promise<void> {
    this.store.categories = this.store.categories.filter((c) => c.id !== id);
    this.persist();
  }

  async getRecordings(): Promise<Recording[]> {
    return [...this.store.recordings].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getRecording(id: number): Promise<RecordingWithFlags | undefined> {
    const recording = this.store.recordings.find((r) => r.id === id);
    if (!recording) return undefined;
    const recordingFlags = this.store.flags.filter((f) => f.recordingId === id);
    return { ...recording, flags: recordingFlags };
  }

  async createRecording(recording: InsertRecording): Promise<Recording> {
    const id = this.store.nextRecordingId++;
    const row: RecordingRow = {
      id,
      name: recording.name,
      category: recording.category ?? "Recordings",  // Changed from "Uncategorized" to "Recordings"
      categoryId: recording.categoryId ?? null,
      duration: recording.duration ?? 0,
      notes: recording.notes ?? "",
      createdAt: new Date(),
    };
    this.store.recordings.push(row);
    this.persist();
    return row;
  }

  async updateRecording(id: number, updates: UpdateRecordingRequest): Promise<Recording> {
    const idx = this.store.recordings.findIndex((r) => r.id === id);
    if (idx === -1) {
      const err = new Error("Recording not found") as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }
    const row = { ...this.store.recordings[idx], ...updates };
    this.store.recordings[idx] = row as RecordingRow;
    this.persist();
    return row as Recording;
  }

  async deleteRecording(id: number): Promise<void> {
    this.store.recordings = this.store.recordings.filter((r) => r.id !== id);
    this.store.flags = this.store.flags.filter((f) => f.recordingId !== id);
    this.persist();
  }

  async createFlag(flag: InsertFlag): Promise<Flag> {
    const id = this.store.nextFlagId++;
    const row: FlagRow = {
      id,
      recordingId: flag.recordingId,
      timestamp: flag.timestamp,
      color: flag.color ?? "red",
      description: flag.description ?? "",
    };
    this.store.flags.push(row);
    this.persist();
    return row;
  }

  async updateFlag(id: number, updates: UpdateFlagRequest): Promise<Flag> {
    const idx = this.store.flags.findIndex((f) => f.id === id);
    if (idx === -1) {
      const err = new Error("Flag not found") as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }
    const row = { ...this.store.flags[idx], ...updates };
    this.store.flags[idx] = row as FlagRow;
    this.persist();
    return row as Flag;
  }

  async deleteFlag(id: number): Promise<void> {
    this.store.flags = this.store.flags.filter((f) => f.id !== id);
    this.persist();
  }

  async getFlagsForRecording(recordingId: number): Promise<Flag[]> {
    return this.store.flags.filter((f) => f.recordingId === recordingId);
  }
}
