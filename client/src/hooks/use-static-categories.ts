import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getCategories, 
  createCategory as createCategoryLocal, 
  deleteCategory as deleteCategoryLocal
} from "../lib/local-storage";
import type { Category } from "../types";

// ============================================
// STATIC CATEGORIES HOOKS
// ============================================

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      return getCategories();
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; color?: string }) => {
      return createCategoryLocal({
        name: data.name,
        color: data.color || "gray"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const success = deleteCategoryLocal(id);
      if (!success) throw new Error("Cannot delete category");
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      // Also invalidate recordings since they might be affected
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
    },
  });
}
