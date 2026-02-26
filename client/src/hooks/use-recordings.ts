import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type RecordingInput } from "@shared/routes";

// ============================================
// RECORDINGS HOOKS
// ============================================

export function useRecordings() {
  return useQuery({
    queryKey: [api.recordings.list.path],
    queryFn: async () => {
      const res = await fetch(api.recordings.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch recordings");
      return api.recordings.list.responses[200].parse(await res.json());
    },
  });
}

export function useRecording(id: number) {
  return useQuery({
    queryKey: [api.recordings.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.recordings.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch recording");
      return api.recordings.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateRecording() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: RecordingInput) => {
      const validated = api.recordings.create.input.parse(data);
      const res = await fetch(api.recordings.create.path, {
        method: api.recordings.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.recordings.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create recording");
      }
      return api.recordings.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.recordings.list.path] }),
  });
}

export function useUpdateRecording() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<RecordingInput>) => {
      const validated = api.recordings.update.input.parse(updates);
      const url = buildUrl(api.recordings.update.path, { id });
      const res = await fetch(url, {
        method: api.recordings.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update recording");
      return api.recordings.update.responses[200].parse(await res.json());
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [api.recordings.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.recordings.get.path, data.id] });
    },
  });
}

export function useDeleteRecording() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.recordings.delete.path, { id });
      const res = await fetch(url, { method: api.recordings.delete.method, credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete recording");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.recordings.list.path] }),
  });
}
