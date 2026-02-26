import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
import { Flag } from "@shared/schema";
import { Play, Pause, Flag as FlagIcon, ZoomIn, ZoomOut, Scissors } from "lucide-react";

interface WaveformPlayerProps {
  blob?: Blob;
  flags: Flag[];
  onFlagClick?: (flag: Flag) => void;
  height?: number;
  initialRegion?: [number, number];
  initialSeekTime?: number;
  onRegionChange?: (range: [number, number]) => void;
  onOpenSnippetEditor?: () => void;
  onWaveformClick?: (time: number) => void;
}

export function WaveformPlayer({ blob, flags, onFlagClick, height = 128, initialRegion, initialSeekTime, onRegionChange, onOpenSnippetEditor, onWaveformClick }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<any>(null);
  const flagContainerRef = useRef<HTMLDivElement | null>(null);
  const regionBoundsRef = useRef<[number, number] | null>(initialRegion ?? null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(50); // minPxPerSec
  const [focusTime, setFocusTime] = useState<number | undefined>(initialSeekTime); // Store flag timestamp for anchoring during zoom
  const [clickedPosition, setClickedPosition] = useState<number | null>(null);

  // Update focusTime when initialSeekTime changes
  useEffect(() => {
    setFocusTime(initialSeekTime);
  }, [initialSeekTime]);

  useEffect(() => {
    if (!containerRef.current || !blob) return;

    // Initialize WaveSurfer
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4b5563', // gray-600
      progressColor: '#7c3aed', // violet-600
      cursorColor: '#0ea5e9', // sky-500
      barWidth: 2,
      barGap: 3,
      barRadius: 3,
      height: height,
      normalize: true,
      minPxPerSec: 50,
      autoScroll: true,
      hideScrollbar: false,
    });

    const regions = ws.registerPlugin(RegionsPlugin.create());
    regionsRef.current = regions;

    ws.loadBlob(blob);
    wavesurferRef.current = ws;

    ws.on('ready', () => {
      const dur = ws.getDuration();
      setDuration(dur);
      
      // Add waveform click handler
      ws.getWrapper().addEventListener('click', (e) => {
        const rect = ws.getWrapper().getBoundingClientRect();
        const x = e.clientX - rect.left;
        const scrollLeft = ws.getWrapper().parentElement?.scrollLeft || 0;
        const clickX = x + scrollLeft;
        const clickTime = (clickX / ws.getWrapper().scrollWidth) * dur;
        setClickedPosition(clickTime);
        // Don't call onWaveformClick here - only when Flag It button is clicked
      });
      
      // TEMP: DOM structure investigation
      const waveformWrapper = ws.getWrapper();
      console.log('=== WAVEFORM DOM STRUCTURE ===');
      console.log('waveformWrapper:', waveformWrapper);
      console.log('waveformWrapper.scrollWidth:', waveformWrapper.scrollWidth);
      console.log('waveformWrapper.clientWidth:', waveformWrapper.clientWidth);
      console.log('waveformWrapper.scrollLeft:', waveformWrapper.scrollLeft);

      const parent = waveformWrapper.parentElement;
      if (parent) {
        console.log('parent:', parent);
        console.log('parent.scrollWidth:', parent.scrollWidth);
        console.log('parent.clientWidth:', parent.clientWidth);
        console.log('parent.scrollLeft:', parent.scrollLeft);

        const grandparent = parent.parentElement;
        if (grandparent) {
          console.log('grandparent:', grandparent);
          console.log('grandparent.scrollWidth:', grandparent.scrollWidth);
          console.log('grandparent.clientWidth:', grandparent.clientWidth);
          console.log('grandparent.scrollLeft:', grandparent.scrollLeft);
        }
      }

      // Find scrollable element
      let el: HTMLElement | null = ws.getWrapper();
      while (el) {
        const overflow = getComputedStyle(el).overflow + getComputedStyle(el).overflowX;
        if (overflow.includes('auto') || overflow.includes('scroll')) {
          console.log('scrollable element found:', el, 'scrollWidth:', el.scrollWidth);
        }
        el = el.parentElement;
      }
      console.log('=== END DOM STRUCTURE ===');
      
      // Get the scrollable wrapper element (this is the element that scrolls)
      const wrapper = ws.getWrapper();
      
      // Create flag container inside the scrollable wrapper
      // This ensures flags scroll naturally with the waveform - no manual sync needed.
      // Keep position:absolute and fixed width so this container never changes the wrapper's
      // scrollWidth (which would shift all flag positions). Use overflow:visible so tooltips can show.
      if (!flagContainerRef.current) {
        const flagContainer = document.createElement('div');
        flagContainer.className = 'wavesurfer-flag-container';
        flagContainer.style.cssText = 'position: absolute; top: 0; left: 0; height: 100%; width: 0; pointer-events: none; z-index: 10; overflow: visible;';
        wrapper.appendChild(flagContainer);
        flagContainerRef.current = flagContainer;
      }
      
      // Set initial flag container width
      if (flagContainerRef.current) {
        flagContainerRef.current.style.width = `${wrapper.scrollWidth}px`;
      }
      
      // Sync flags as regions for perfect scrolling
      regions.getRegions().forEach(r => r.remove());
      
      flags.forEach(flag => {
        regions.addRegion({
          id: `flag-${flag.id}`,
          start: flag.timestamp / 1000,
          end: (flag.timestamp / 1000) + 0.1, // Minimal width
          color: 'transparent', // Custom rendering handles the look
          drag: false,
          resize: false,
          // Use any to bypass type checking for custom data
          ...({ data: { flag } } as any)
        });
      });

      if (initialRegion) {
        regions.addRegion({
          id: 'snippet-region',
          start: initialRegion[0],
          end: initialRegion[1],
          color: 'rgba(124, 58, 237, 0.2)',
          drag: true,
          resize: true,
        });

        requestAnimationFrame(() => {
          setTimeout(() => {
            if (!ws) return;
            const focusTime = initialRegion[0]; // Always start at the beginning of the region (in-slider)
            ws.setTime(focusTime);
            const startPx = focusTime * 50;
            ws.getWrapper().scrollTo({
              left: startPx - 100,
              behavior: 'smooth'
            });
            // Ensure scroll is clamped after initial positioning
            setTimeout(() => {
              const scrollEl = ws.getWrapper().parentElement;
              if (!scrollEl) return;
              console.log('Initial scroll container:', scrollEl, 'scrollWidth:', scrollEl.scrollWidth, 'clientWidth:', scrollEl.clientWidth);
              const duration = ws.getDuration();
              const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
              const target = (focusTime! / duration) * scrollEl.scrollWidth - scrollEl.clientWidth / 2;
              scrollEl.scrollLeft = Math.max(0, Math.min(target, maxScroll));
            }, 50);
          }, 100);
        });
      }
    });

    regions.on('region-clicked', (region, e) => {
      if (region.id.startsWith('flag-')) {
        e.stopPropagation();
        const flag = (region as any).data?.flag;
        if (flag) {
          onFlagClick?.(flag);
        }
      }
    });

    // No need to sync scroll - flags are now children of the scrollable container

    regions.on('region-updated', (region) => {
      if (region.id === 'snippet-region') {
        regionBoundsRef.current = [region.start, region.end];
      }
      onRegionChange?.([region.start, region.end]);
    });

    ws.on('audioprocess', () => {
      const time = ws.getCurrentTime();
      setCurrentTime(time);
      
      // Stop at out point if in region mode
      const bounds = regionBoundsRef.current;
      if (bounds) {
        if (time >= bounds[1]) {
          ws.pause();
          ws.setTime(bounds[0]);
          setIsPlaying(false);
        }
      }
    });

    ws.on('finish', () => {
      setIsPlaying(false);
    });

    // Redraw handler is set up in the ready callback

    return () => {
      // Clean up flag container
      if (flagContainerRef.current && flagContainerRef.current.parentNode) {
        flagContainerRef.current.parentNode.removeChild(flagContainerRef.current);
        flagContainerRef.current = null;
      }
      ws.destroy();
    };
  }, [blob, height]);

  const togglePlay = () => {
    if (wavesurferRef.current) {
      if (!isPlaying && regionBoundsRef.current) {
        const bounds = regionBoundsRef.current;
        const time = wavesurferRef.current.getCurrentTime();
        // Allow a small buffer for precision
        if (time < bounds[0] - 0.1 || time >= bounds[1] - 0.05) {
          wavesurferRef.current.setTime(bounds[0]);
        }
      }
      wavesurferRef.current.playPause();
    }
  };

  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    
    const p = () => setIsPlaying(true);
    const s = () => setIsPlaying(false);
    
    ws.on('play', p);
    ws.on('pause', s);
    ws.on('finish', s);
    
    return () => {
      ws.un('play', p);
      ws.un('pause', s);
      ws.un('finish', s);
    };
  }, []);

  // Render flags inside the WaveSurfer wrapper container
  useEffect(() => {
    const ws = wavesurferRef.current;
    const flagContainer = flagContainerRef.current;
    if (!ws || !flagContainer || !duration || duration === 0) return;

    const wrapper = ws.getWrapper();
    const scrollWidth = wrapper.scrollWidth;
    
    // Update container width
    flagContainer.style.width = `${scrollWidth}px`;
    
    // Create a map of existing flags by ID for efficient updates
    const existingFlags = new Map<number, HTMLElement>();
    flagContainer.querySelectorAll('button[data-flag-id]').forEach((btn) => {
      const flagId = parseInt(btn.getAttribute('data-flag-id') || '0');
      if (flagId) existingFlags.set(flagId, btn as HTMLElement);
    });
    
    // Track which flags we've processed
    const processedFlagIds = new Set<number>();
    
    // Update or create flags
    flags.forEach((flag) => {
      processedFlagIds.add(flag.id);
      const positionPercent = (flag.timestamp / 1000) / duration;
      const positionPx = positionPercent * scrollWidth;
      
      // Get color for the flag based on flag.color
      const getFlagColor = (color: string): string => {
        switch(color) {
          case 'red': return '#ef4444';
          case 'green': return '#10b981';
          case 'blue': return '#3b82f6';
          case 'purple': return '#a855f7';
          case 'orange': return '#f97316';
          default: return '#10b981'; // Default to green
        }
      };
      const bgColor = getFlagColor(flag.color);
      
      // Check if flag already exists
      const existingButton = existingFlags.get(flag.id);
      
      if (existingButton) {
        // Update existing flag - only update position and color if needed
        const currentLeft = parseFloat(existingButton.style.left) || 0;
        const newLeft = positionPx;
        
        // Only update if position changed (to avoid unnecessary reflows)
        if (Math.abs(currentLeft - newLeft) > 0.1) {
          existingButton.style.left = `${newLeft}px`;
        }
        
        // Update color if changed
        const flagDiv = existingButton.querySelector('div[data-flag-color]') as HTMLElement;
        if (flagDiv && flagDiv.style.backgroundColor !== bgColor) {
          flagDiv.style.backgroundColor = bgColor;
        }
        
        // Update tooltip text if changed
        const tooltip = existingButton.querySelector('div[data-tooltip]') as HTMLElement;
        if (tooltip && tooltip.textContent !== (flag.description || 'Flagged Moment')) {
          tooltip.textContent = flag.description || 'Flagged Moment';
        }
      } else {
        // Create new flag button
        const flagButton = document.createElement('button');
        flagButton.setAttribute('data-flag-id', flag.id.toString());
        flagButton.style.cssText = `left: ${positionPx}px; position: absolute; top: 0; transform: translateX(-50%); pointer-events: auto; cursor: pointer; background: none; border: none; padding: 0; z-index: 10; display: flex; flex-direction: column; align-items: center;`;
        
        flagButton.onpointerdown = (e) => {
          e.preventDefault();
          e.stopPropagation();
          onFlagClick?.(flag);
        };
        
        // Flag line - subtle vertical line
        const line = document.createElement('div');
        line.style.cssText = `width: 1px; height: 1rem; background-color: rgba(0, 0, 0, 0.1); pointer-events: none; margin-bottom: 0.25rem;`;
        flagButton.appendChild(line);
        
        // Flag icon container - colored circle with flag icon
        const flagDiv = document.createElement('div');
        flagDiv.setAttribute('data-flag-color', flag.color);
        flagDiv.style.cssText = `position: relative; padding: 0.375rem; border-radius: 9999px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 2px solid white; background-color: ${bgColor}; transition: transform 0.2s;`;
        
        // Hover effect
        flagButton.addEventListener('mouseenter', () => {
          flagDiv.style.transform = 'scale(1.25)';
          line.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
        });
        flagButton.addEventListener('mouseleave', () => {
          flagDiv.style.transform = 'scale(1)';
          line.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
        });
        
        // Flag icon SVG - white flag icon
        const flagIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        flagIcon.setAttribute('viewBox', '0 0 24 24');
        flagIcon.setAttribute('fill', 'white');
        flagIcon.style.cssText = 'width: 0.75rem; height: 0.75rem; display: block;';
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z');
        path.setAttribute('fill', 'white');
        flagIcon.appendChild(path);
        flagDiv.appendChild(flagIcon);
        flagButton.appendChild(flagDiv);
        
        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.setAttribute('data-tooltip', 'true');
        tooltip.textContent = flag.description || 'Flagged Moment';
        tooltip.style.cssText = 'position: absolute; bottom: 100%; margin-bottom: 0.5rem; left: 50%; transform: translateX(-50%); background-color: hsl(var(--popover)); color: hsl(var(--popover-foreground)); font-size: 0.75rem; padding: 0.25rem 0.5rem; border-radius: 0.25rem; opacity: 0; white-space: nowrap; pointer-events: none; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); border: 1px solid rgba(0, 0, 0, 0.1); transition: opacity 0.2s;';
        flagButton.appendChild(tooltip);
        
        // Hover effect for tooltip
        flagButton.addEventListener('mouseenter', () => {
          tooltip.style.opacity = '1';
        });
        flagButton.addEventListener('mouseleave', () => {
          tooltip.style.opacity = '0';
        });
        
        flagContainer.appendChild(flagButton);
      }
    });
    
    // Remove flags that no longer exist
    existingFlags.forEach((button, flagId) => {
      if (!processedFlagIds.has(flagId)) {
        button.remove();
      }
    });
    
    // Update width and reposition flags on zoom/redraw
    const updateWidthAndReposition = () => {
      const newWidth = wrapper.scrollWidth;
      flagContainer.style.width = `${newWidth}px`;
        
      // Reposition all flags with new width - use flag ID to match, not array index
      const flagButtons = flagContainer.querySelectorAll('button[data-flag-id]');
      flagButtons.forEach((button) => {
        const el = button as HTMLElement;
        const flagId = parseInt(el.getAttribute('data-flag-id') || '0');
        const flag = flags.find((f) => f.id === flagId);
        if (flag) {
          const positionPercent = (flag.timestamp / 1000) / duration;
          const positionPx = positionPercent * newWidth;
          el.style.left = `${positionPx}px`;
        }
      });
    };
    
    // Set up event listeners for width updates
    ws.on('zoom', updateWidthAndReposition);
    ws.on('redraw', updateWidthAndReposition);
    
    return () => {
      ws.un('zoom', updateWidthAndReposition);
      ws.un('redraw', updateWidthAndReposition);
    };
  }, [duration, flags, onFlagClick]);

  // Flags are now rendered directly in the WaveSurfer wrapper via useEffect
  // No need for React-rendered flag markers

  return (
    <div className="w-full space-y-4">
      <div className="relative bg-card/30 rounded-2xl p-4 border border-border shadow-[inset_0_1px_1px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] overflow-hidden">
        <div className="relative w-full overflow-hidden">
          {/* WaveSurfer container - flags are injected directly into its wrapper */}
          <div ref={containerRef} className="w-full relative z-10" />
        </div>
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={togglePlay}
            className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 text-sm sm:text-base"
          >
            {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />}
            <span className="hidden sm:inline">{isPlaying ? "Pause" : "Play"}</span>
          </button>

          {onOpenSnippetEditor && (
            <button
              onClick={onOpenSnippetEditor}
              className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full bg-secondary text-secondary-foreground font-semibold hover:bg-secondary/80 transition-colors text-sm sm:text-base"
              title="Open Snippet Editor"
            >
              <Scissors className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Snippet Editor</span>
            </button>
          )}

          {onWaveformClick && (
            <button
              onClick={() => {
                if (clickedPosition !== null && onWaveformClick) {
                  onWaveformClick(clickedPosition);
                  setClickedPosition(null); // Reset after placing flag
                }
              }}
              disabled={clickedPosition === null}
              className={`flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full font-semibold transition-colors text-sm sm:text-base ${
                clickedPosition !== null 
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                  : 'bg-primary text-primary-foreground opacity-50 cursor-not-allowed'
              }`}
              title="Flag It"
            >
              <FlagIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Flag It</span>
            </button>
          )}
        </div>

        {initialRegion && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const next = Math.max(10, zoomLevel / 1.5);
                console.log('Zoom out to:', next);
                setZoomLevel(next);
                const ws = wavesurferRef.current;
                if (!ws) return;
                ws.setOptions({ minPxPerSec: next });
                setTimeout(() => {
                  const scrollEl = ws.getWrapper().parentElement;
                  const wrapper = ws.getWrapper();
                  if (!scrollEl || !wrapper) return;
                  const duration = ws.getDuration();
                  
                  // Force the correct wrapper width for this zoom level
                  console.log('Before forcing width - wrapper.style.width:', wrapper.style.width);
                  const correctWidth = Math.ceil(duration * next);
                  wrapper.style.width = `${correctWidth}px`;
                  wrapper.style.overflow = 'hidden'; // prevent canvases from overflowing
                  console.log('After forcing width - wrapper.style.width:', wrapper.style.width);
                  
                  // Now scrollWidth will reflect the correct size
                  console.log('Post-zoom-out scrollWidth after overflow fix:', scrollEl.scrollWidth);
                  const maxScroll = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
                  if (focusTime !== undefined) {
                    const target = (focusTime / duration) * correctWidth - scrollEl.clientWidth / 2;
                    scrollEl.scrollLeft = Math.max(0, Math.min(target, maxScroll));
                    console.log('Final scrollLeft (with anchor):', scrollEl.scrollLeft);
                  } else {
                    scrollEl.scrollLeft = Math.min(scrollEl.scrollLeft, maxScroll);
                    console.log('Final scrollLeft (no anchor):', scrollEl.scrollLeft);
                  }
                }, 50);
              }}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-muted-foreground w-10 text-center">{Math.round(zoomLevel)}x</span>
            <button
              onClick={() => {
                const next = Math.min(500, zoomLevel * 1.5);
                console.log('Zoom in to:', next);
                setZoomLevel(next);
                const ws = wavesurferRef.current;
                if (!ws) return;
                ws.setOptions({ minPxPerSec: next });
                setTimeout(() => {
                  const scrollEl = ws.getWrapper().parentElement;
                  const wrapper = ws.getWrapper();
                  if (!scrollEl || !wrapper) return;
                  const duration = ws.getDuration();
                  
                  // Force the correct wrapper width for this zoom level
                  console.log('Before forcing width - wrapper.style.width:', wrapper.style.width);
                  const correctWidth = Math.ceil(duration * next);
                  wrapper.style.width = `${correctWidth}px`;
                  wrapper.style.overflow = 'hidden'; // prevent canvases from overflowing
                  console.log('After forcing width - wrapper.style.width:', wrapper.style.width);
                  
                  // Now scrollWidth will reflect the correct size
                  console.log('Post-zoom-in scrollWidth after overflow fix:', scrollEl.scrollWidth);
                  const maxScroll = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
                  if (focusTime !== undefined) {
                    const target = (focusTime / duration) * correctWidth - scrollEl.clientWidth / 2;
                    scrollEl.scrollLeft = Math.max(0, Math.min(target, maxScroll));
                    console.log('Final scrollLeft (with anchor):', scrollEl.scrollLeft);
                  } else {
                    scrollEl.scrollLeft = Math.min(scrollEl.scrollLeft, maxScroll);
                    console.log('Final scrollLeft (no anchor):', scrollEl.scrollLeft);
                  }
                }, 50);
              }}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        )}
        
        <div className="font-mono text-sm text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </div>
  );
}

function getColorClass(color: string) {
  switch(color) {
    case 'red': return 'bg-red-500';
    case 'green': return 'bg-emerald-500';
    case 'blue': return 'bg-blue-500';
    case 'purple': return 'bg-purple-500';
    case 'orange': return 'bg-orange-500';
    default: return 'bg-emerald-500'; // Default to green
  }
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
