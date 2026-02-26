import type { Recording, InsertRecording, Flag, InsertFlag, Category, InsertCategory } from "../types";

const STORAGE_KEY = 'flagit-data';
const NEXT_IDS_KEY = 'flagit-next-ids';

interface StorageData {
  recordings: Recording[];
  flags: Flag[];
  categories: Category[];
}

interface NextIds {
  recording: number;
  flag: number;
  category: number;
}

// Initialize storage with default data
function getInitialData(): StorageData {
  return {
    recordings: [],
    flags: [],
    categories: [
      { id: 1, name: "Recordings", color: "gray" },
      { id: 2, name: "Personal", color: "blue" },
      { id: 3, name: "Work", color: "green" },
      { id: 4, name: "Ideas", color: "purple" }
    ]
  };
}

function getInitialIds(): NextIds {
  return { recording: 1, flag: 1, category: 5 }; // Start categories at 5 since we have 4 defaults
}

// Get data from localStorage
function getStorageData(): StorageData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...getInitialData(), ...parsed };
    }
    return getInitialData();
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return getInitialData();
  }
}

// Save data to localStorage
function saveStorageData(data: StorageData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}

// Get next IDs
function getNextIds(): NextIds {
  try {
    const stored = localStorage.getItem(NEXT_IDS_KEY);
    return stored ? JSON.parse(stored) : getInitialIds();
  } catch (error) {
    console.error('Error reading next IDs:', error);
    return getInitialIds();
  }
}

// Save next IDs
function saveNextIds(ids: NextIds): void {
  try {
    localStorage.setItem(NEXT_IDS_KEY, JSON.stringify(ids));
  } catch (error) {
    console.error('Error saving next IDs:', error);
  }
}

// Get next ID and increment
function getNextId(type: keyof NextIds): number {
  const ids = getNextIds();
  const nextId = ids[type];
  ids[type] = nextId + 1;
  saveNextIds(ids);
  return nextId;
}

// ==================== RECORDINGS ====================

export function getRecordings(): Recording[] {
  return getStorageData().recordings;
}

export function getRecording(id: number): Recording | null {
  const recordings = getRecordings();
  return recordings.find(r => r.id === id) || null;
}

export function createRecording(data: InsertRecording): Recording {
  const storageData = getStorageData();
  const recording: Recording = {
    id: getNextId('recording'),
    name: data.name,
    category: data.category || "Recordings",
    categoryId: data.categoryId || null,
    duration: data.duration || 0,
    notes: data.notes || "",
    createdAt: new Date()
  };
  storageData.recordings.push(recording);
  saveStorageData(storageData);
  return recording;
}

export function updateRecording(id: number, updates: Partial<InsertRecording>): Recording | null {
  const storageData = getStorageData();
  const index = storageData.recordings.findIndex(r => r.id === id);
  if (index === -1) return null;
  
  storageData.recordings[index] = { ...storageData.recordings[index], ...updates };
  saveStorageData(storageData);
  return storageData.recordings[index];
}

export function deleteRecording(id: number): boolean {
  const storageData = getStorageData();
  const index = storageData.recordings.findIndex(r => r.id === id);
  if (index === -1) return false;
  
  // Remove recording
  storageData.recordings.splice(index, 1);
  
  // Remove associated flags
  storageData.flags = storageData.flags.filter(f => f.recordingId !== id);
  
  saveStorageData(storageData);
  return true;
}

// ==================== FLAGS ====================

export function getFlagsForRecording(recordingId: number): Flag[] {
  const flags = getStorageData().flags;
  return flags.filter(f => f.recordingId === recordingId);
}

export function createFlag(data: InsertFlag): Flag {
  const storageData = getStorageData();
  const flag: Flag = {
    id: getNextId('flag'),
    recordingId: data.recordingId,
    timestamp: data.timestamp,
    color: data.color || "red",
    description: data.description || ""
  };
  storageData.flags.push(flag);
  saveStorageData(storageData);
  return flag;
}

export function updateFlag(id: number, updates: Partial<InsertFlag>): Flag | null {
  const storageData = getStorageData();
  const index = storageData.flags.findIndex(f => f.id === id);
  if (index === -1) return null;
  
  storageData.flags[index] = { ...storageData.flags[index], ...updates };
  saveStorageData(storageData);
  return storageData.flags[index];
}

export function deleteFlag(id: number): boolean {
  const storageData = getStorageData();
  const index = storageData.flags.findIndex(f => f.id === id);
  if (index === -1) return false;
  
  storageData.flags.splice(index, 1);
  saveStorageData(storageData);
  return true;
}

// ==================== CATEGORIES ====================

export function getCategories(): Category[] {
  return getStorageData().categories;
}

export function getCategory(id: number): Category | null {
  const categories = getCategories();
  return categories.find(c => c.id === id) || null;
}

export function createCategory(data: InsertCategory): Category {
  const storageData = getStorageData();
  const category: Category = {
    id: getNextId('category'),
    name: data.name,
    color: data.color || "gray"
  };
  storageData.categories.push(category);
  saveStorageData(storageData);
  return category;
}

export function deleteCategory(id: number): boolean {
  const storageData = getStorageData();
  const index = storageData.categories.findIndex(c => c.id === id);
  if (index === -1) return false;
  
  // Don't allow deletion of default categories (ids 1-4)
  if (id <= 4) return false;
  
  storageData.categories.splice(index, 1);
  
  // Update recordings that used this category to "Recordings" (id: 1)
  storageData.recordings.forEach(recording => {
    if (recording.categoryId === id) {
      recording.categoryId = 1;
      recording.category = "Recordings";
    }
  });
  
  saveStorageData(storageData);
  return true;
}

// ==================== UTILITY ====================

export function exportData(): string {
  const data = getStorageData();
  const ids = getNextIds();
  return JSON.stringify({ data, ids }, null, 2);
}

export function importData(jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed.data && parsed.ids) {
      saveStorageData(parsed.data);
      saveNextIds(parsed.ids);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error importing data:', error);
    return false;
  }
}

export function clearAllData(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(NEXT_IDS_KEY);
}
