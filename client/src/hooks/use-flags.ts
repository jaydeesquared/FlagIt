import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type FlagInput } from "@shared/routes";

// ============================================
// FLAGS HOOKS
// ============================================

export function useCreateFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: FlagInput) => {
      const validated = api.flags.create.input.parse(data);
      const res = await fetch(api.flags.create.path, {
        method: api.flags.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.flags.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create flag");
      }
      return api.flags.create.responses[201].parse(await res.json());
    },
    onSuccess: (data) => {
      // Invalidate the specific recording to refresh its flags list
      queryClient.invalidateQueries({ 
        queryKey: [api.recordings.get.path, data.recordingId] 
      });
    },
  });
}

export function useUpdateFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<FlagInput>) => {
      const validated = api.flags.update.input.parse(updates);
      const url = buildUrl(api.flags.update.path, { id });
      const res = await fetch(url, {
        method: api.flags.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update flag");
      return api.flags.update.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: [api.recordings.get.path, data.recordingId] 
      });
    },
  });
}

export function useDeleteFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, recordingId }: { id: number, recordingId: number }) => {
      const url = buildUrl(api.flags.delete.path, { id });
      const res = await fetch(url, { method: api.flags.delete.method, credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete flag");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: [api.recordings.get.path, variables.recordingId] 
      });
    },
  });
}
