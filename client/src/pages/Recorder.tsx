import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Mic, Square, Flag as FlagIcon, ChevronLeft, ChevronRight, Save, AlertCircle, Settings as SettingsIcon, Moon, Sun } from "lucide-react";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { useCreateRecording } from "@/hooks/use-static-recordings";
import { useCreateFlag } from "@/hooks/use-static-flags";
import { saveAudioBlob } from "@/lib/indexed-db";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/hooks/use-theme";

// Types for local state
interface TempFlag {
  id: string; // temporary ID
  timestamp: number;
  color: string;
}

export default function Recorder() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  
  // State
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [tempFlags, setTempFlags] = useState<{ id: string; timestamp: number; description: string; isVoice: boolean }[]>([]);
  const [speechStatus, setSpeechStatus] = useState<'idle' | 'listening' | 'error'>('idle');
  const [userActivated, setUserActivated] = useState(false);
  const [lastRecordingId, setLastRecordingId] = useState<number | null>(null);
  const { theme, toggleTheme } = useTheme();
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null); // SpeechRecognition
  const isRecordingRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  // Mutations
  const createRecording = useCreateRecording();
  const createFlag = useCreateFlag();

  // 1. Setup Audio Stream & Speech Recognition
  useEffect(() => {
    async function setupStream() {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setStream(audioStream);

        // Setup Speech Recognition (Web Speech API)
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = false;
          
          // Auto-detect browser language for mobile compatibility
          const detectedLang = navigator.language || 'en-US';
          const supportedLangs = ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR'];
          recognition.lang = supportedLangs.includes(detectedLang) ? detectedLang : 'en-US';
          
          recognition.onresult = (event: any) => {
            const last = event.results.length - 1;
            const transcript = event.results[last][0].transcript.toLowerCase().trim();
            console.log("Speech detected:", transcript);
            
            // Check for trigger phrase (support multiple languages)
            const triggers = ['flag it', 'flag that', 'flagit', 'marca', 'marque', 'markieren'];
            if (triggers.some(trigger => transcript.includes(trigger))) {
              handleAddFlag("Voice Triggered", true);
            }
          };

          // Add speech status feedback
          recognition.onstart = () => {
            setSpeechStatus('listening');
            console.log("Speech recognition started");
          };
          
          recognition.onerror = (event: any) => {
            console.log("Speech recognition error:", event.error);
            setSpeechStatus('error');
            handleMobileSpeechError(event);
          };
          
          recognition.onend = () => {
            setSpeechStatus('idle');
            // Auto-restart recognition when it ends (browsers stop it periodically)
            if (isRecordingRef.current && userActivated) {
              try {
                recognition.start();
                console.log("Speech recognition restarted");
              } catch (e) {
                console.log("Speech recognition restart failed, retrying...", e);
                setTimeout(() => {
                  if (isRecordingRef.current && userActivated) {
                    try { recognition.start(); } catch (_) {}
                  }
                }, 300);
              }
            }
          };
          
          recognitionRef.current = recognition;
        }
      } catch (err) {
        console.error("Microphone access denied:", err);
        toast({
          variant: "destructive",
          title: "Microphone Error",
          description: "Please allow microphone access to record audio.",
        });
      }
    }
    setupStream();

    return () => {
      stream?.getTracks().forEach(track => track.stop());
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  // Mobile-specific speech error handler
  const handleMobileSpeechError = (event: any) => {
    if (event.error === 'not-allowed') {
      toast({
        title: "Microphone Access Required",
        description: "Please tap the record button to enable voice commands.",
      });
    } else if (event.error === 'network') {
      toast({
        title: "Network Error",
        description: "Voice commands require internet connection.",
      });
    } else if (event.error === 'no-speech') {
      // Don't show error for no-speech, it's normal
      console.log("No speech detected, continuing...");
    } else {
      console.log("Speech recognition error:", event.error);
    }
  };

  // 2. Start Recording
  const startRecording = () => {
    if (!stream) return;

    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
        console.log("Chunk recorded:", e.data.size);
      }
    };

    mediaRecorder.onstop = () => {
      console.log("Recorder stopped, total chunks:", chunksRef.current.length);
    };

    mediaRecorder.start(1000); // Collect data in 1s chunks
    setIsRecording(true);
    isRecordingRef.current = true;
    startTimeRef.current = Date.now();
    setDuration(0);
    setTempFlags([]);
    
    // Set user activation for mobile speech recognition
    setUserActivated(true);

    // Start Timer
    timerRef.current = setInterval(() => {
      setDuration(Date.now() - startTimeRef.current);
    }, 100) as NodeJS.Timeout;

    // Start Speech Recognition (mobile-compatible)
    try {
      if (recognitionRef.current) {
        recognitionRef.current.start();
        console.log("Speech recognition started successfully");
      }
    } catch (e) {
      console.log("Speech recognition start failed:", e);
      // On mobile, this might fail initially, but will retry onend
      toast({
        title: "Voice Commands",
        description: "Voice commands will activate when you speak.",
      });
    }
  };

  // 3. Stop & Save
  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return;

    mediaRecorderRef.current.stop();
    setIsRecording(false);
    isRecordingRef.current = false;
    setUserActivated(false); // Reset user activation
    setSpeechStatus('idle'); // Reset speech status
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    recognitionRef.current?.stop();

    // Create the final blob
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    const finalDuration = duration;

    try {
      // 1. Create Recording Entry in DB
      const recording = await createRecording.mutateAsync({
        name: `Recording ${new Date().toLocaleString()}`,
        category: "Recordings",
        categoryId: null,
        duration: finalDuration,
        notes: "",
      });

      // 2. Save Blob to IndexedDB
      await saveAudioBlob(recording.id, blob);

      // 3. Save Flags
      await Promise.all(tempFlags.map(flag => 
        createFlag.mutateAsync({
          recordingId: recording.id,
          timestamp: flag.timestamp,
          color: flag.isVoice ? "red" : "green",
          description: flag.description,
        })
      ));

      setLastRecordingId(recording.id);

      toast({
        title: "Recording saved",
        description: "Your recording has been added to your collection.",
        duration: 3000,
      });

      // Stay on page, reset local state
      setDuration(0);
      setTempFlags([]);
      chunksRef.current = [];
    } catch (err) {
      console.error("Save recording error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: `Could not save the recording: ${errorMessage}`,
      });
    }
  };

  // 4. Add Flag Handler
  const handleAddFlag = (source: string = "Manual", isVoice: boolean = false) => {
    // Use a ref or a direct check to avoid stale closure issues if needed, 
    // but here we check the state.
    setIsRecording(prev => {
      if (!prev) return prev;
      
      let timestamp = Date.now() - startTimeRef.current;
      
      // Apply 1-second offset for voice-triggered flags
      if (isVoice) {
        timestamp = Math.max(0, timestamp - 1000);
      }
      
      const newFlag = {
        id: Math.random().toString(),
        timestamp,
        description: source,
        isVoice,
      };

      setTempFlags(current => [...current, newFlag]);
      
      toast({
        title: "Flag Added!",
        description: `${source} at ${formatTime(timestamp)}`,
        duration: 1500,
      });
      return prev;
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Pulse Effect when Recording */}
      {isRecording && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse" />
        </div>
      )}

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <Link href="/recordings">
            <button className="px-4 py-2 hover:bg-card rounded-full transition-colors text-muted-foreground hover:text-foreground font-medium flex items-center gap-2">
              Recordings
              <ChevronRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleTheme} className="p-2 hover:bg-card rounded-full transition-colors text-muted-foreground hover:text-foreground">
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <Link href="/settings">
            <button className="p-2 hover:bg-card rounded-full transition-colors text-muted-foreground hover:text-foreground">
              <SettingsIcon className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-card/50 border border-white/5 backdrop-blur-sm">
            <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-sm font-mono text-muted-foreground">{isRecording ? 'REC' : 'READY'}</span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-2xl space-y-12 z-10">
        {/* Timer Display */}
        <div className="text-center space-y-4">
          <h1 className="text-7xl font-mono font-bold tracking-tighter timer-text tabular-nums">
            {formatTime(duration)}
          </h1>
          <div className="space-y-1">
            <p className="text-lg text-primary font-semibold max-w-sm mx-auto leading-relaxed">
              Say <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-bold">FLAG IT</span>
            </p>
            <p className="text-lg text-primary font-semibold max-w-sm mx-auto leading-relaxed">
              or click the flag</p>
            <p className="text-lg text-primary font-semibold max-w-sm mx-auto leading-relaxed">to mark key moments
            </p>
          </div>
        </div>

        {/* Visualizer */}
        <div className="h-32 bg-card/30 rounded-2xl border border-white/5 backdrop-blur-sm overflow-hidden flex items-center justify-center relative">
          {stream ? (
            <AudioVisualizer stream={stream} isRecording={isRecording} height={128} />
          ) : (
             <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="w-5 h-5" />
                <span>Waiting for microphone...</span>
             </div>
          )}
          {/* Flag Markers on Timeline (Visual only) */}
          {tempFlags.map((flag) => (
             <motion.div
               key={flag.id}
               initial={{ scale: 0, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="absolute top-0 bottom-0 w-0.5 bg-green-500"
               style={{ left: `${(flag.timestamp / duration) * 100}%` }}
             />
          ))}
        </div>

        {/* Status Display */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {formatTime(duration)}
          </h1>
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            {isRecording ? (
              <>
                {speechStatus === 'listening' && (
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                )}
                {speechStatus === 'error' && (
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                )}
                {speechStatus === 'idle' && (
                  <div className="w-2 h-2 bg-gray-400 rounded-full" />
                )}
                {speechStatus === 'listening' 
                  ? "Listening for 'Flag It'..." 
                  : speechStatus === 'error'
                  ? "Voice commands unavailable"
                  : "Voice commands ready"
                }
              </>
            ) : "Press record to start"}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-8">
          {/* Flag Button */}
          <button
            onClick={() => handleAddFlag("Manual")}
            disabled={!isRecording}
            className="group flex flex-col items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center shadow-lg group-hover:border-green-500/50 group-active:scale-95 transition-all">
              <FlagIcon className="w-6 h-6 text-green-500 fill-current" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Flag</span>
          </button>

          {/* Record / Stop Button */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95
              ${isRecording 
                ? 'bg-red-500 text-white animate-pulse-ring' 
                : 'record-button text-white'
              }`}
          >
            {isRecording ? (
              <Square className="w-8 h-8 fill-current" />
            ) : (
              <Mic className="w-8 h-8 fill-current text-white dark:text-black" />
            )}
          </button>

          {/* Go to Recording Button (or spacer) */}
          {lastRecordingId ? (
            <button
              onClick={() => setLocation(`recordings/${lastRecordingId}`)}
              className="group w-16 flex flex-col items-center gap-2 transition-all"
            >
              <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center shadow-lg group-hover:border-primary/50 group-active:scale-95 transition-all">
                <ChevronRight className="w-6 h-6 text-primary" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Latest</span>
            </button>
          ) : (
            <div className="w-16 flex flex-col items-center gap-2 opacity-0 pointer-events-none">
              <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center shadow-lg" />
              <span className="text-sm font-medium text-muted-foreground">Latest</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centis = Math.floor((ms % 1000) / 10);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
}
