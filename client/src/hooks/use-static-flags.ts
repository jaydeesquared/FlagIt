import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  createFlag as createFlagLocal,
  updateFlag as updateFlagLocal,
  deleteFlag as deleteFlagLocal
} from "../lib/local-storage";
import type { InsertFlag } from "../types";

// ============================================
// STATIC FLAGS HOOKS
// ============================================

export function useCreateFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertFlag) => {
      return createFlagLocal(data);
    },
    onSuccess: (data) => {
      // Invalidate the specific recording to refresh its flags list
      queryClient.invalidateQueries({ 
        queryKey: ["recording", data.recordingId] 
      });
    },
  });
}

export function useUpdateFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertFlag>) => {
      const result = updateFlagLocal(id, updates);
      if (!result) throw new Error("Flag not found");
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ["recording", data.recordingId] 
      });
    },
  });
}

export function useDeleteFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, recordingId }: { id: number; recordingId: number }) => {
      const success = deleteFlagLocal(id);
      if (!success) throw new Error("Flag not found");
      return { id, recordingId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ["recording", variables.recordingId] 
      });
    },
  });
}
