import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { convertBlobToMp3 } from '@/lib/audio-convert';

interface ShareRecordingOptions {
  blob: Blob;
  recordingName: string;
  recordingUrl?: string; // Optional URL for copying link
}

export function useShareRecording() {
  const [isSharing, setIsSharing] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const { toast } = useToast();

  // Proper feature detection for file sharing
  const canShareFiles = () => {
    if (!navigator.canShare) return false;
    const testFile = new File([''], 'test.mp3', { type: 'audio/mpeg' });
    return navigator.canShare({ files: [testFile] });
  };

  const shareRecording = async ({ blob, recordingName, recordingUrl }: ShareRecordingOptions) => {
    if (!blob) return;

    // Check if we can share files
    if (!canShareFiles()) {
      setShowFallback(true);
      return;
    }

    setIsSharing(true);

    try {
      // Generate MP3 using existing logic
      const mp3Blob = await convertBlobToMp3(blob);
      const file = new File([mp3Blob], `${recordingName}.mp3`, { type: 'audio/mpeg' });

      try {
        await navigator.share({
          title: recordingName,
          files: [file],
        });
      } catch (err) {
        // Handle user cancellation silently
        if ((err as Error).name !== 'AbortError') {
          console.error('Error sharing:', err);
          toast({
            title: 'Share Failed',
            description: 'Could not share the recording. Please try again.',
            variant: 'destructive',
          });
        }
      }
    } catch (err) {
      console.error('Error preparing share:', err);
      toast({
        title: 'Export Failed',
        description: 'Could not prepare the MP3 file for sharing.',
        variant: 'destructive',
      });
    } finally {
      setIsSharing(false);
    }
  };

  const downloadMp3 = async () => {
    // This will be called from the fallback dropdown
    // We'll need access to the blob and recording name
    setShowFallback(false);
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Link Copied',
        description: 'Recording URL copied to clipboard.',
      });
    } catch (err) {
      console.error('Error copying link:', err);
      toast({
        title: 'Copy Failed',
        description: 'Could not copy the link to clipboard.',
        variant: 'destructive',
      });
    }
    setShowFallback(false);
  };

  return {
    shareRecording,
    isSharing,
    showFallback,
    setShowFallback,
    downloadMp3,
    copyLink,
    canShareFiles: canShareFiles(),
  };
}
