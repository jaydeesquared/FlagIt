import type {
  InsertRecording,
  UpdateRecordingRequest,
  InsertFlag,
  UpdateFlagRequest,
  Recording,
  Flag,
  RecordingWithFlags,
  Category,
  InsertCategory,
} from "@shared/schema";

export interface IStorage {
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  deleteCategory(id: number): Promise<void>;

  getRecordings(): Promise<Recording[]>;
  getRecording(id: number): Promise<RecordingWithFlags | undefined>;
  createRecording(recording: InsertRecording): Promise<Recording>;
  updateRecording(id: number, updates: UpdateRecordingRequest): Promise<Recording>;
  deleteRecording(id: number): Promise<void>;

  createFlag(flag: InsertFlag): Promise<Flag>;
  updateFlag(id: number, updates: UpdateFlagRequest): Promise<Flag>;
  deleteFlag(id: number): Promise<void>;
  getFlagsForRecording(recordingId: number): Promise<Flag[]>;
}
