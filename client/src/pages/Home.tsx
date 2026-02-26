import { Link, useLocation } from "wouter";
import { useMemo, useState } from "react";
import { useRecordings } from "@/hooks/use-recordings";
import { useCategories } from "@/hooks/use-categories";
import { Mic, Clock, Tag, ChevronRight, PlayCircle, Settings as SettingsIcon, Download, Trash2, CheckSquare, Square, Moon, Sun } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useDeleteRecording } from "@/hooks/use-recordings";
import { useToast } from "@/hooks/use-toast";
import { getAudioBlob, deleteAudioBlob } from "@/lib/indexed-db";
import JSZip from "jszip";
import { convertBlobToMp3 } from "@/lib/audio-convert";
import { useTheme } from "@/hooks/use-theme";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function Home() {
  const { data: recordings, isLoading } = useRecordings();
  const { data: categories } = useCategories();
  const deleteRecording = useDeleteRecording();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("All");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // Group recordings by category
  const groupedRecordings = recordings?.reduce((acc, recording) => {
    const catName = recording.category || "Recordings";
    if (!acc[catName]) acc[catName] = [];
    acc[catName].push(recording);
    return acc;
  }, {} as Record<string, typeof recordings>);

  const activeCategories = useMemo(() => {
  const allCategoryNames = (categories || []).map((cat: any) => cat.name);
  const recordingCategoryNames = Object.keys(groupedRecordings || {});
  const combinedCategories = Array.from(new Set([...allCategoryNames, ...recordingCategoryNames]));
  return combinedCategories.sort((a, b) => {
    if (a === "Recordings") return -1;
    if (b === "Recordings") return 1;
    return a.localeCompare(b);
  });
}, [categories, groupedRecordings]);

  const recordingsById = useMemo(() => {
    const map = new Map<number, any>();
    (recordings ?? []).forEach((r: any) => map.set(r.id, r));
    return map;
  }, [recordings]);

  const selectedRecordings = useMemo(() => {
    return Array.from(selectedIds)
      .map((id) => recordingsById.get(id))
      .filter(Boolean);
  }, [selectedIds, recordingsById]);

  const visibleRecordings = useMemo(() => {
    if (!recordings) return [];
    if (activeTab === "All") return recordings;
    return groupedRecordings?.[activeTab] ?? [];
  }, [activeTab, recordings, groupedRecordings]);

  const visibleIds = useMemo(() => visibleRecordings.map((r: any) => r.id), [visibleRecordings]);

  const allVisibleSelected = useMemo(() => {
    if (visibleIds.length === 0) return false;
    return visibleIds.every((id) => selectedIds.has(id));
  }, [visibleIds, selectedIds]);

  const allRecordingIds = useMemo(() => (recordings ?? []).map((r: any) => r.id), [recordings]);

  const allRecordingsSelected = useMemo(() => {
    if (allRecordingIds.length === 0) return false;
    return allRecordingIds.every((id) => selectedIds.has(id));
  }, [allRecordingIds, selectedIds]);

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        // Unselect all visible recordings
        visibleIds.forEach((id) => next.delete(id));
      } else {
        // Select all visible recordings, but unselect any that are not visible
        // Start with just the visible ones
        const newSelection = new Set<number>();
        visibleIds.forEach((id) => newSelection.add(id));
        return newSelection;
      }
      return next;
    });
  };

  const selectAllRecordings = () => {
    setSelectedIds((prev) => {
      if (allRecordingsSelected) {
        // Clear all selections if all are already selected
        return new Set();
      } else {
        // Select all recordings
        return new Set(allRecordingIds);
      }
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  // Helper function to get full recording data like RecordingDetails does
  const getFullRecordingData = async (recordingId: number) => {
    const response = await fetch(`/api/recordings/${recordingId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch recording ${recordingId}`);
    }
    return response.json();
  };

  const handleDownloadSelected = async () => {
    if (selectedIds.size === 0) return;
    setShowDownloadModal(true);
  };

  const executeDownload = async () => {
    if (selectedIds.size === 0) return;
    setIsDownloading(true);
    setShowDownloadModal(false);
    
    try {
      const items = selectedRecordings;
      const missing: any[] = [];
      const zip = new JSZip();

      if (items.length === 1) {
        const rec = items[0];
        const blob = await getAudioBlob(rec.id);
        if (!blob) {
          toast({
            variant: "destructive",
            title: "Audio not found",
            description: "This recording's audio blob wasn't found in local storage.",
          });
          return;
        }

        const mp3Blob = await convertBlobToMp3(blob);
        const url = URL.createObjectURL(mp3Blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = recordingFilename(rec, new Map());
        a.click();
        URL.revokeObjectURL(url);

        if (includeNotes) {
          const notesContent = `Recording: ${rec.name}
Date: ${format(new Date(rec.createdAt), "yyyy-MM-dd 'at' HH:mm")}
Duration: ${formatDuration(rec.duration)}
Category: ${rec.category || "Recordings"}

Notes:
${rec.notes || 'No notes added'}`;
          downloadBlob(new Blob([notesContent], { type: 'text/plain' }), recordingFilename(rec, new Map()).replace('.mp3', '.txt'));
        }

        toast({
          title: "Download complete",
          description: `${rec.name} has been downloaded.`,
        });
      } else {
        // For multiple recordings, track name counts for sequential numbering
        const nameCounts = new Map<string, number>();
        const recordingNumbers = new Map<number, number>();
        
        // First pass: count occurrences of each base name
        items.forEach(rec => {
          const baseName = sanitizePathPart(rec.name || `recording-${rec.id}`);
          nameCounts.set(baseName, (nameCounts.get(baseName) || 0) + 1);
        });
        
        // Second pass: assign sequential numbers to duplicates
        const currentNumbers = new Map<string, number>();
        items.forEach(rec => {
          const baseName = sanitizePathPart(rec.name || `recording-${rec.id}`);
          if ((nameCounts.get(baseName) || 0) > 1) {
            const currentNum = (currentNumbers.get(baseName) || 0) + 1;
            currentNumbers.set(baseName, currentNum);
            recordingNumbers.set(rec.id, currentNum);
          }
        });

        let added = 0;
        for (const fullRecording of items) {
          try {
            const blob = await getAudioBlob(fullRecording.id);
            if (!blob) {
              missing.push(fullRecording);
              continue;
            }

            const mp3Blob = await convertBlobToMp3(blob);
            const category = sanitizePathPart(fullRecording.category || "Recordings");
            const folder = zip.folder(category) ?? zip;
            folder.file(recordingFilename(fullRecording, recordingNumbers), mp3Blob);
            
            // Add notes file if includeNotes is checked
            if (includeNotes) {
              const notesContent = `Recording: ${fullRecording.name}
Date: ${format(new Date(fullRecording.createdAt), "yyyy-MM-dd 'at' HH:mm")}
Duration: ${formatDuration(fullRecording.duration)}
Category: ${fullRecording.category || "Recordings"}

Notes:
${fullRecording.notes || 'No notes added'}`;
              folder.file(recordingFilename(fullRecording, recordingNumbers).replace('.mp3', '.txt'), notesContent);
            }
            
            added += 1;
          } catch (err) {
            console.error(`Failed to process recording ${fullRecording.id}:`, err);
            missing.push(fullRecording);
          }
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `recordings-${format(new Date(), "yyyy-MM-dd-HHmm")}.zip`;
        a.click();
        URL.revokeObjectURL(url);

        if (missing.length > 0) {
          toast({
            variant: "destructive",
            title: "Some recordings missing",
            description: `${missing.length} recordings couldn't be downloaded because their audio wasn't found in local storage.`,
          });
        } else {
          toast({
            title: "Download complete",
            description: `${added} recordings have been downloaded.`,
          });
        }
      }
    } catch (error) {
      console.error("Download error:", error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "An error occurred while preparing the download.",
      });
    } finally {
      setIsDownloading(false);
      setIncludeNotes(false); // Reset checkbox
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      let deleted = 0;
      let failed = 0;

      for (const id of Array.from(selectedIds)) {
        try {
          await deleteRecording.mutateAsync(id);
          await deleteAudioBlob(id);
          deleted += 1;
        } catch (e) {
          failed += 1;
        }
      }

      clearSelection();

      if (failed > 0) {
        toast({
          variant: "destructive",
          title: "Some deletions failed",
          description: `Deleted ${deleted}. Failed ${failed}.`,
        });
      } else {
        toast({ title: "Deleted", description: `Deleted ${deleted} recording(s).` });
      }
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent cursor-pointer">
              FLAG IT
            </h1>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/">
              <button className="flex items-center gap-2 bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-full font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg hover:shadow-xl">
                <Mic className="w-4 h-4" />
                <span className="hidden sm:inline">New Recording</span>
              </button>
            </Link>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="rounded-full">
                <SettingsIcon className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-foreground mb-2">My Recordings</h2>
          <div className="space-y-1">
            <p className="text-lg text-primary font-semibold">Click a flag on the waveform to save snippets of key moments.</p>
          </div>
        </div>

        {!!recordings?.length && (
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card/50 border border-border rounded-xl p-3">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={toggleSelectAllVisible}
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                {allVisibleSelected ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                Select all in view
              </button>

              <button
                type="button"
                onClick={selectAllRecordings}
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                {allRecordingsSelected ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                All recordings
              </button>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2">
              <div className="text-sm text-muted-foreground mr-2">
                Selected: <span className="font-semibold text-foreground">{selectedIds.size}</span>
              </div>

              <Button
                variant="outline"
                onClick={handleDownloadSelected}
                disabled={selectedIds.size === 0 || isDownloading || isDeleting}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                {isDownloading ? "Preparing..." : "Download"}
              </Button>

              <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={selectedIds.size === 0 || isDownloading || isDeleting}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete {selectedIds.size} recording(s) and remove their audio from local storage.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        void handleDeleteSelected();
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-card animate-pulse border border-border" />
            ))}
          </div>
        ) : recordings?.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-3xl bg-card/30">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Mic className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No recordings yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Start capturing your thoughts and flagging important moments.
            </p>
            <Link href="/">
              <button className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                Start Recording
              </button>
            </Link>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 bg-card border border-border p-1">
              <TabsTrigger value="All">All</TabsTrigger>
              {activeCategories.map(cat => (
                <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="All">
              <div className="grid gap-4 w-full overflow-hidden">
                {recordings?.map((recording) => (
                  <RecordingCard
                    key={recording.id}
                    recording={recording}
                    selected={selectedIds.has(recording.id)}
                    onToggleSelected={() => toggleSelected(recording.id)}
                  />
                ))}
              </div>
            </TabsContent>

            {activeCategories.map(cat => (
              <TabsContent key={cat} value={cat}>
                <div className="grid gap-4 w-full overflow-hidden">
                  {groupedRecordings?.[cat]?.map((recording) => (
                    <RecordingCard
                      key={recording.id}
                      recording={recording}
                      selected={selectedIds.has(recording.id)}
                      onToggleSelected={() => toggleSelected(recording.id)}
                    />
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </main>

      {/* Download Modal */}
      <DownloadModal
        open={showDownloadModal}
        onOpenChange={setShowDownloadModal}
        includeNotes={includeNotes}
        onIncludeNotesChange={setIncludeNotes}
        onDownload={executeDownload}
        onCancel={() => {
          setShowDownloadModal(false);
          setIncludeNotes(false);
        }}
      />
    </div>
  );
}

function RecordingCard({
  recording,
  selected,
  onToggleSelected,
}: {
  recording: any;
  selected: boolean;
  onToggleSelected: () => void;
}) {
  const [, setLocation] = useLocation();
  return (
    <div
      className="group relative bg-card hover:bg-card/80 border border-border hover:border-primary/50 rounded-xl p-3 sm:p-5 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5"
      role="button"
      tabIndex={0}
      onClick={() => setLocation(`/recordings/${recording.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setLocation(`/recordings/${recording.id}`);
      }}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        <div className="flex items-start gap-2 sm:gap-4 min-w-0">
          <button
            type="button"
            aria-label={selected ? "Deselect recording" : "Select recording"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleSelected();
            }}
            className="mt-1 inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-md border border-border bg-background/60 hover:bg-background transition-colors shrink-0"
          >
            {selected ? <CheckSquare className="w-3 h-3 sm:w-4 sm:h-4 text-primary" /> : <Square className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />}
          </button>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="p-1.5 sm:p-2 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                <PlayCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="font-semibold text-sm sm:text-lg text-foreground group-hover:text-primary transition-colors truncate min-w-0 flex-1">
                {recording.name}
              </h3>
            </div>

            <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground pl-8 sm:pl-12">
              <span className="flex items-center gap-1 sm:gap-1.5">
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                {formatDuration(recording.duration)}
              </span>
              <span className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                <Tag className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="truncate">{recording.category}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
        </div>
      </div>
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

function sanitizePathPart(input: string) {
  return input.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

function recordingFilename(recording: any, recordingNumbers: Map<number, number>) {
  const base = sanitizePathPart(recording.name || `recording-${recording.id}`);
  const number = recordingNumbers.get(recording.id);
  if (number && number > 0) {
    return `${base} (${number}).mp3`;
  }
  return `${base}.mp3`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function getExtension(mimeType: string) {
  switch (mimeType) {
    case "audio/wav":
      return "wav";
    case "audio/mpeg":
      return "mp3";
    case "audio/ogg":
      return "ogg";
    case "audio/mp4":
      return "m4a";
    default:
      return "bin";
  }
}

function DownloadModal({ open, onOpenChange, includeNotes, onIncludeNotesChange, onDownload, onCancel }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  includeNotes: boolean;
  onIncludeNotesChange: (checked: boolean) => void;
  onDownload: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card text-foreground border-border">
        <DialogHeader>
          <DialogTitle>Download Recordings</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Would you like to include notes with your download?
          </p>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="include-notes"
              checked={includeNotes}
              onChange={(e) => onIncludeNotesChange(e.target.checked)}
              className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
            />
            <label htmlFor="include-notes" className="text-sm font-medium text-foreground">
              Yes, include notes
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onDownload}>
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
