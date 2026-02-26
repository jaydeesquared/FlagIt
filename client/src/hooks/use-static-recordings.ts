import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getRecordings, 
  getRecording, 
  createRecording as createRecordingLocal, 
  updateRecording as updateRecordingLocal, 
  deleteRecording as deleteRecordingLocal,
  getFlagsForRecording
} from "../lib/local-storage";
import type { Recording, InsertRecording } from "../types";

// ============================================
// STATIC RECORDINGS HOOKS
// ============================================

export function useRecordings() {
  return useQuery({
    queryKey: ["recordings"],
    queryFn: async () => {
      return getRecordings();
    },
  });
}

export function useRecording(id: number) {
  return useQuery({
    queryKey: ["recording", id],
    queryFn: async () => {
      const recording = getRecording(id);
      if (!recording) return null;
      
      // Attach flags to recording
      const flags = getFlagsForRecording(id);
      return { ...recording, flags };
    },
    enabled: !!id,
  });
}

export function useCreateRecording() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertRecording) => {
      return createRecordingLocal(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
    },
  });
}

export function useUpdateRecording() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertRecording>) => {
      const result = updateRecordingLocal(id, updates);
      if (!result) throw new Error("Recording not found");
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
      queryClient.invalidateQueries({ queryKey: ["recording", data.id] });
    },
  });
}

export function useDeleteRecording() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const success = deleteRecordingLocal(id);
      if (!success) throw new Error("Recording not found");
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
    },
  });
}
