import React, { useRef, useEffect } from 'react';

interface VisualizerProps {
  analyser: AnalyserNode;
  isPlaying: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ analyser, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size for high DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isPlaying) {
        // Simple idle animation or clear
        ctx.clearRect(0, 0, rect.width, rect.height);
        
        // Draw a flat line
        ctx.beginPath();
        ctx.moveTo(0, rect.height / 2);
        ctx.lineTo(rect.width, rect.height / 2);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
      }

      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.3)'; // Trail effect
      ctx.fillRect(0, 0, rect.width, rect.height);

      ctx.lineWidth = 3;
      // Gradient stroke
      const gradient = ctx.createLinearGradient(0, 0, rect.width, 0);
      gradient.addColorStop(0, '#22d3ee'); // Cyan
      gradient.addColorStop(0.5, '#a855f7'); // Purple
      gradient.addColorStop(1, '#f472b6'); // Pink
      ctx.strokeStyle = gradient;

      ctx.beginPath();

      const sliceWidth = rect.width * 1.0 / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * (rect.height / 2);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, rect.height / 2);
      ctx.stroke();
    };

    if (isPlaying) {
        draw();
    } else {
        // Initial draw for idle state
        draw();
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [analyser, isPlaying]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-40 bg-slate-900 rounded-xl border border-slate-800 shadow-inner"
    />
  );
};

export default Visualizer;