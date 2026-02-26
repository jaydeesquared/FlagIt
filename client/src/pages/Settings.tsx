import { useCategories, useCreateCategory, useDeleteCategory } from "@/hooks/use-categories";
import { useRecordings } from "@/hooks/use-recordings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, Settings as SettingsIcon } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: categories } = useCategories();
  const { data: recordings } = useRecordings();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const [newCategoryName, setNewCategoryName] = useState("");

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    
    try {
      await createCategory.mutateAsync({ name: newCategoryName.trim() });
      setNewCategoryName("");
      toast({ title: "Category created" });
    } catch (err) {
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: "Could not create category. It might already exist." 
      });
    }
  };

  const handleDeleteCategory = async (id: number) => {
    const hasRecordings = recordings?.some(r => r.categoryId === id);
    if (hasRecordings) {
      toast({
        variant: "destructive",
        title: "Cannot delete",
        description: "This category still has recordings attached to it."
      });
      return;
    }

    if (confirm("Are you sure you want to delete this category?")) {
      await deleteCategory.mutateAsync(id);
      toast({ title: "Category deleted" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation("/")}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-muted-foreground" />
            Settings
          </h1>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>Manage your recording categories</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleCreateCategory} className="flex gap-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New category name..."
                className="max-w-xs"
              />
              <Button type="submit" disabled={createCategory.isPending}>
                <Plus className="w-4 h-4 mr-2" /> Add
              </Button>
            </form>

            <div className="grid gap-2">
              {categories?.map((category) => {
                const count = recordings?.filter(r => r.categoryId === category.id).length || 0;
                return (
                  <div 
                    key={category.id} 
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border"
                  >
                    <div>
                      <span className="font-medium">{category.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">({count} recordings)</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteCategory(category.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
              {categories?.length === 0 && (
                <p className="text-center py-4 text-muted-foreground">No categories created yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
