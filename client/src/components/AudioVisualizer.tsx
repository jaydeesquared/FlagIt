import { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  stream: MediaStream;
  isRecording: boolean;
  height?: number;
}

export function AudioVisualizer({ stream, isRecording, height = 64 }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode>();
  const contextRef = useRef<AudioContext>();

  useEffect(() => {
    if (!stream || !isRecording) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Initialize Audio Context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    contextRef.current = audioContext;
    
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecording) return;
      
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = 'rgba(17, 24, 39, 0.0)'; // Transparent clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;

        // Create gradient
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#7c3aed'); // Violet-600 (Primary)
        gradient.addColorStop(1, '#0ea5e9'); // Sky-500 (Accent)

        ctx.fillStyle = gradient;
        
        // Rounded bars
        ctx.beginPath();
        ctx.roundRect(x, canvas.height - barHeight, barWidth, barHeight, [4]);
        ctx.fill();

        x += barWidth + 2; // Spacing
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (contextRef.current?.state !== 'closed') contextRef.current?.close();
    };
  }, [stream, isRecording]);

  return (
    <canvas 
      ref={canvasRef} 
      width={600} 
      height={height} 
      className="w-full h-full rounded-lg"
    />
  );
}
