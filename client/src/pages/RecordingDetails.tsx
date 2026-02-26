import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useRecording, useDeleteRecording, useUpdateRecording, useCreateRecording } from "@/hooks/use-recordings";
import { useCreateFlag, useUpdateFlag, useDeleteFlag } from "@/hooks/use-flags";
import { useCategories, useCreateCategory } from "@/hooks/use-categories";
import { getAudioBlob, saveAudioBlob } from "@/lib/indexed-db";
import { bufferToWav } from "@/lib/audio-utils";
import { convertBlobToMp3 } from "@/lib/audio-convert";
import { useTheme } from "@/hooks/use-theme";
import { WaveformPlayer } from "@/components/WaveformPlayer";
import { useToast } from "@/hooks/use-toast";
import { Flag, ArrowLeft, Calendar, Trash2, Edit2, Download, MoreVertical, Save, Settings as SettingsIcon, Moon, Sun } from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function RecordingDetails() {
  const [_, params] = useRoute("/recordings/:id");
  const [, setLocation] = useLocation();
  const id = Number(params?.id);
  const { toast } = useToast();
  
  // Data Fetching
  const { data: recording, isLoading } = useRecording(id);
  const { data: categories } = useCategories();
  const createCategory = useCreateCategory();
  const updateRecording = useUpdateRecording();
  const createRecording = useCreateRecording();
  const deleteRecording = useDeleteRecording();
  
  const createFlag = useCreateFlag();
  const updateFlag = useUpdateFlag();
  const deleteFlag = useDeleteFlag();

  // Local State
  const [blob, setBlob] = useState<Blob | undefined>(undefined);
  const [selectedFlag, setSelectedFlag] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [snippetRange, setSnippetRange] = useState<[number, number] | null>(null);
  const [snippetSeekTime, setSnippetSeekTime] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [snippetName, setSnippetName] = useState("");
  const [snippetCategoryId, setSnippetCategoryId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [isCreatingSnippetCategory, setIsCreatingSnippetCategory] = useState(false);
  const [newSnippetCategoryName, setNewSnippetCategoryName] = useState("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editFlagColor, setEditFlagColor] = useState("");
  const [editFlagDesc, setEditFlagDesc] = useState("");
  const [flagDirty, setFlagDirty] = useState(false);
  const [isSnippetEditorOpen, setIsSnippetEditorOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // Load Audio Blob from IndexedDB
  useEffect(() => {
    if (id) {
      getAudioBlob(id).then(setBlob);
    }
  }, [id]);

  useEffect(() => {
    if (recording) {
      setNotes(recording.notes || "");
    }
  }, [recording]);

  useEffect(() => {
    if (selectedFlag) {
      setEditFlagColor(selectedFlag.color || "green");
      setEditFlagDesc(selectedFlag.description || "");
      setFlagDirty(false);
    }
  }, [selectedFlag]);

  // Handlers
  const handleSaveNotes = async () => {
    await updateRecording.mutateAsync({ id, notes });
    toast({
      title: "Notes Saved",
      description: "Recording notes have been updated.",
    });
  };

  const handleExportNotes = () => {
    if (!recording) return;
    
    // Create detailed notes content similar to the download modal logic
    const notesContent = `${recording.name}
${'='.repeat(recording.name.length)}

Recorded: ${new Date(recording.createdAt).toLocaleString()}
Duration: ${formatDuration(recording.duration)}
Category: ${recording.category || 'Recordings'}
Flags: ${recording.flags.length} flag(s)

${recording.flags.length > 0 ? 'Flagged Moments:\n' + recording.flags.sort((a, b) => a.timestamp - b.timestamp).map(flag => 
  `• ${formatTime(flag.timestamp)} - ${flag.description || 'Untitled Flag'}`
).join('\n') + '\n' : ''}

Notes:
${notes || 'No notes added'}`;
    
    const blob = new Blob([notesContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${recording.name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handlers
  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this recording? This cannot be undone.")) {
      await deleteRecording.mutateAsync(id);
      setLocation("/");
    }
  };

  const handleEditSave = async () => {
    if (editName.trim()) {
      await updateRecording.mutateAsync({ id, name: editName });
      setIsEditing(false);
    }
  };

  const handleFlagSave = async () => {
    if (selectedFlag) {
      await updateFlag.mutateAsync({ id: selectedFlag.id, color: editFlagColor, description: editFlagDesc });
      setFlagDirty(false);
    }
  };

  const handleFlagDelete = async () => {
    if (selectedFlag) {
      await deleteFlag.mutateAsync({ id: selectedFlag.id, recordingId: id });
      setSelectedFlag(null);
    }
  };

  // Helper function to generate snippet name based on timestamp
  const generateSnippetName = (timestamp: number) => {
    const date = new Date(timestamp);
    const dateString = format(date, "dd/MM/yyyy");
    const timeString = format(date, "HH:mm:ss");
    return `Snippet ${dateString}, ${timeString}`;
  };

  const handleOpenSnippetEditor = (flag: any) => {
    if (!recording) return;
    const flagTime = flag.timestamp / 1000;
    const start = Math.max(0, flagTime - 5);
    const end = Math.min(recording.duration / 1000, flagTime + 5);
    setSnippetRange([start, end]);
    setSnippetSeekTime(flagTime);
    setSnippetName(generateSnippetName(flag.timestamp));
    setSnippetCategoryId(recording.categoryId);
    setSelectedFlag(flag);
  };

  const handleExportSnippet = async () => {
    if (!blob || !snippetRange || !recording) return;
    
    setIsExporting(true);
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const [start, end] = snippetRange;
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(start * sampleRate);
      const endSample = Math.floor(end * sampleRate);
      const frameCount = Math.max(1, endSample - startSample);
      
      const newBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        frameCount,
        sampleRate
      );
      
      for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
        const channelData = audioBuffer.getChannelData(i);
        const newChannelData = newBuffer.getChannelData(i);
        newChannelData.set(channelData.slice(startSample, endSample));
      }
      
      const wavBlob = await bufferToWav(newBuffer);
      
      const categoryName = categories?.find(c => c.id === snippetCategoryId)?.name || "Recordings";

      // Save as a new recording
      const newRec = await createRecording.mutateAsync({
        name: snippetName || `${recording.name} (Snippet)`,
        category: categoryName,
        categoryId: snippetCategoryId,
        duration: Math.round((end - start) * 1000),
      });

      if (!newRec?.id) {
        throw new Error("Failed to create new recording entry");
      }

      await saveAudioBlob(newRec.id, wavBlob);
      
      toast({
        title: "Snippet Saved",
        description: `Saved to ${categoryName} category.`,
        action: (
          <button
            onClick={() => {
              window.location.href = `/recordings/${newRec.id}`;
            }}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Go to snippet?
          </button>
        ),
      });
      setSnippetRange(null);
      setSnippetSeekTime(null);
      setSelectedFlag(null);
      setIsSnippetEditorOpen(false);
    } catch (err) {
      console.error("Save snippet error:", err);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: err instanceof Error ? err.message : "Could not save snippet.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = async () => {
    if (!blob || !recording) return;
    const mp3Blob = await convertBlobToMp3(blob);
    const url = URL.createObjectURL(mp3Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${recording.name}.mp3`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleWaveformClick = async (time: number) => {
    if (!recording) return;
    // Create a new flag at the clicked timestamp
    await createFlag.mutateAsync({
      recordingId: recording.id,
      timestamp: Math.round(time * 1000), // Convert to milliseconds
      color: "green", // Green color for manually created flags
      description: "Flagged It",
    });
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    try {
      const newCat = await createCategory.mutateAsync({ name: newCategoryName.trim() });
      updateRecording.mutate({ id, categoryId: newCat.id, category: newCat.name });
      setNewCategoryName("");
      setIsCreatingCategory(false);
    } catch (err) {
      console.error("Error creating category:", err);
    }
  };

  if (isLoading || !recording) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Navbar */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <button 
              onClick={() => setLocation("/recordings")}
              className="p-2 hover:bg-card rounded-full transition-colors text-muted-foreground hover:text-foreground flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            {isEditing ? (
              <div className="flex items-center gap-2 min-w-0">
                <Input 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 w-48 sm:w-64 bg-card flex-shrink-0"
                  autoFocus
                />
                <Select 
                  value={recording.categoryId?.toString() || "none"} 
                  onValueChange={async (val) => {
                    if (val === "create-new") {
                      setIsCreatingCategory(true);
                      return;
                    }
                    const categoryId = val === "none" ? null : Number(val);
                    const categoryName = categories?.find(c => c.id === categoryId)?.name || "Recordings";
                    updateRecording.mutate({ id, categoryId, category: categoryName });
                  }}
                >
                  <SelectTrigger className="h-8 w-32 sm:w-40 flex-shrink-0">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Recordings</SelectItem>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                    ))}
                    <SelectItem value="create-new" className="text-primary font-medium">+ Create New</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleEditSave} className="flex-shrink-0">Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="flex-shrink-0">Cancel</Button>
              </div>
            ) : (
              <h1 className="text-lg sm:text-xl font-bold truncate min-w-0 flex-1">Recordings</h1>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setLocation("/settings")}>
              <SettingsIcon className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { setEditName(recording.name); setIsEditing(true); }}>
              <Edit2 className="w-4 h-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" /> Download Recording
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleDelete}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete Recording
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Recording Name Header */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{recording.name}</h1>
        </div>

        {/* Meta Info */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm text-muted-foreground bg-card/50 p-3 sm:p-4 rounded-xl border border-border">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="truncate">{format(new Date(recording.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
          </div>
          <div className="hidden sm:block h-4 w-px bg-border" />
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="truncate">{recording.category || "Recordings"}</span>
          </div>
        </div>

        {/* Player */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <div className="w-1 h-5 bg-primary rounded-full" />
            Playback
          </h2>
          {blob ? (
            <WaveformPlayer 
              blob={blob} 
              flags={recording.flags}
              onFlagClick={setSelectedFlag}
              height={160}
              onOpenSnippetEditor={() => {
                // Open snippet editor with full recording as initial region
                if (recording.duration) {
                  const durationSeconds = recording.duration / 1000;
                  setSnippetRange([0, durationSeconds]);
                  setSnippetSeekTime(durationSeconds / 2); // Start in the middle
                  setSnippetName(generateSnippetName(recording.createdAt));
                  setSnippetCategoryId(recording.categoryId);
                  setIsSnippetEditorOpen(true);
                }
              }}
              onWaveformClick={handleWaveformClick}
            />
          ) : (
            <div className="h-40 bg-card rounded-xl border border-border flex items-center justify-center text-muted-foreground">
              Loading audio...
            </div>
          )}
        </section>

        {/* Flags List */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <div className="w-1 h-5 bg-accent rounded-full" />
            Flagged Moments
          </h2>
          
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recording.flags.length === 0 ? (
               <div className="col-span-full py-12 text-center text-muted-foreground bg-card/30 rounded-xl border border-dashed border-border">
                 No flags added to this recording.
               </div>
            ) : (
              recording.flags.sort((a, b) => a.timestamp - b.timestamp).map((flag) => (
                <div 
                  key={flag.id}
                  onClick={() => setSelectedFlag(flag)}
                  className="group cursor-pointer bg-card hover:bg-card/80 border border-border hover:border-primary/50 p-4 rounded-xl transition-all hover:shadow-lg flex gap-4 items-start"
                >
                  <div className={`mt-1 w-3 h-3 rounded-full shrink-0 ${getColorClass(flag.color)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-mono text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
                        {formatTime(flag.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">
                      {flag.description || "Untitled Flag"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Notes Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <div className="w-1 h-5 bg-blue-500 rounded-full" />
              Notes
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportNotes}>
                <Download className="w-4 h-4 mr-2" /> Export .txt
              </Button>
              <Button size="sm" onClick={handleSaveNotes} disabled={updateRecording.isPending}>
                <Save className="w-4 h-4 mr-2" /> {updateRecording.isPending ? "Saving..." : "Save Notes"}
              </Button>
            </div>
          </div>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add your notes here..."
            className="min-h-[200px] bg-card border-border resize-none"
          />
        </section>
      </main>

      {/* New Category Creation Dialog */}
      <Dialog open={isCreatingCategory} onOpenChange={setIsCreatingCategory}>
        <DialogContent className="bg-card text-foreground border-border">
          <DialogHeader>
            <DialogTitle>Create New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-category-name">Category Name</Label>
              <Input
                id="new-category-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Enter category name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateCategory();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatingCategory(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCategory} disabled={!newCategoryName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flag Edit & Snippet Dialog */}
      <Dialog open={!!selectedFlag || isSnippetEditorOpen} onOpenChange={(open) => {
        if (!open) {
          setSelectedFlag(null);
          setSnippetRange(null);
          setSnippetSeekTime(null);
          setIsSnippetEditorOpen(false);
        }
      }}>
        <DialogContent className="sm:max-w-2xl bg-card text-foreground border-border">
          <DialogHeader>
            <DialogTitle>{snippetRange ? "Audio Snippet Editor" : "Edit Flag"}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4 max-w-full overflow-hidden">
            {snippetRange && blob && (
              <div className="space-y-6 w-full overflow-hidden">
                <div className="p-4 bg-background rounded-lg border border-border w-full overflow-hidden">
                  <WaveformPlayer 
                    blob={blob} 
                    flags={[]} 
                    height={100}
                    initialRegion={snippetRange}
                    initialSeekTime={snippetSeekTime ?? undefined}
                    onRegionChange={setSnippetRange}
                  />
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="snippet-name">Snippet Name</Label>
                    <Input 
                      id="snippet-name"
                      value={snippetName}
                      onChange={(e) => setSnippetName(e.target.value)}
                      placeholder="Enter snippet name"
                      className="bg-background border-border"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="snippet-category">Category</Label>
                    {isCreatingSnippetCategory ? (
                      <div className="flex gap-2">
                        <Input
                          autoFocus
                          value={newSnippetCategoryName}
                          onChange={(e) => setNewSnippetCategoryName(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === "Enter" && newSnippetCategoryName.trim()) {
                              try {
                                const newCat = await createCategory.mutateAsync({ name: newSnippetCategoryName.trim() });
                                setSnippetCategoryId(newCat.id);
                              } catch (err) {
                                toast({ variant: "destructive", title: "Error", description: "Category already exists or failed to create." });
                              }
                              setIsCreatingSnippetCategory(false);
                              setNewSnippetCategoryName("");
                            } else if (e.key === "Escape") {
                              setIsCreatingSnippetCategory(false);
                              setNewSnippetCategoryName("");
                            }
                          }}
                          placeholder="New category name"
                          className="bg-background border-border"
                        />
                        <Button
                          size="sm"
                          disabled={!newSnippetCategoryName.trim()}
                          onClick={async () => {
                            try {
                              const newCat = await createCategory.mutateAsync({ name: newSnippetCategoryName.trim() });
                              setSnippetCategoryId(newCat.id);
                            } catch (err) {
                              toast({ variant: "destructive", title: "Error", description: "Category already exists or failed to create." });
                            }
                            setIsCreatingSnippetCategory(false);
                            setNewSnippetCategoryName("");
                          }}
                        >Add</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setIsCreatingSnippetCategory(false); setNewSnippetCategoryName(""); }}>Cancel</Button>
                      </div>
                    ) : (
                      <Select 
                        value={snippetCategoryId?.toString() || "none"}
                        onValueChange={(val) => {
                          if (val === "create-new") {
                            setIsCreatingSnippetCategory(true);
                            return;
                          }
                          setSnippetCategoryId(val === "none" ? null : Number(val));
                        }}
                      >
                        <SelectTrigger id="snippet-category" className="bg-background border-border">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Recordings</SelectItem>
                          {categories?.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                          ))}
                          <SelectItem value="create-new" className="text-primary font-medium">+ Create New</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <div className="flex justify-between text-xs font-mono text-muted-foreground bg-muted/30 p-2 rounded">
                  <span>Start: {snippetRange[0].toFixed(2)}s</span>
                  <span>End: {snippetRange[1].toFixed(2)}s</span>
                  <span>Duration: {(snippetRange[1] - snippetRange[0]).toFixed(2)}s</span>
                </div>
              </div>
            )}

            {!snippetRange && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    value={editFlagDesc}
                    onChange={(e) => { setEditFlagDesc(e.target.value); setFlagDirty(true); }}
                    className="bg-background border-border"
                    placeholder="What happened at this moment?"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Color Code</Label>
                  <div className="flex gap-2">
                    {['red', 'green', 'blue', 'purple', 'orange'].map(color => (
                       <button
                         key={color}
                         onClick={() => {
                           setEditFlagColor(color);
                           setFlagDirty(true);
                         }}
                         className={`w-8 h-8 rounded-full border-2 ${getColorClass(color)} ${editFlagColor === color ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}
                       />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between sm:justify-between w-full gap-2">
            {!snippetRange ? (
              <>
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={handleFlagDelete}>Delete</Button>
                  <Button className="bg-secondary text-secondary-foreground font-semibold hover:bg-secondary/80" onClick={() => handleOpenSnippetEditor(selectedFlag)}>Snippet Editor</Button>
                </div>
                <Button onClick={handleFlagSave} disabled={!flagDirty}>
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => {
                  setSnippetRange(null);
                  setSnippetSeekTime(null);
                }}>Back to Edit</Button>
                <Button onClick={handleExportSnippet} disabled={isExporting}>
                  {isExporting ? "Saving..." : "Save Snippet"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function getColorClass(color: string) {
  switch(color) {
    case 'red': return 'bg-red-500';
    case 'green': return 'bg-emerald-500';
    case 'blue': return 'bg-blue-500';
    case 'purple': return 'bg-purple-500';
    case 'orange': return 'bg-orange-500';
    default: return 'bg-red-500';
  }
}
