import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Pause, Download, Volume2, RotateCcw, Zap, Sparkles } from 'lucide-react';
import { AudioEngine } from './utils/audioEngine';
import Visualizer from './components/Visualizer';
import EffectControl from './components/EffectControl';
import { AudioEffects } from './types';

const audioEngine = new AudioEngine();

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [effects, setEffects] = useState<AudioEffects>({
    pitch: 0,
    echoDelay: 0,
    echoFeedback: 0,
    isReversed: false
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      setFile(selectedFile);
      setIsPlaying(false);
      audioEngine.stop();
      
      try {
        await audioEngine.loadFile(selectedFile);
      } catch (e) {
        console.error("Error loading audio", e);
        alert("Could not load audio file.");
      }
    }
  };

  const togglePlay = () => {
    if (!file) return;

    if (isPlaying) {
      audioEngine.pause();
      setIsPlaying(false);
    } else {
      audioEngine.play(effects, () => setIsPlaying(false));
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    audioEngine.stop();
    setIsPlaying(false);
  };

  // Update effects in real-time when sliders move
  useEffect(() => {
    audioEngine.updateEffects(effects);
  }, [effects]);

  // If Reverse is toggled, we must restart playback because it requires buffer manipulation
  const toggleReverse = () => {
    const newReverseState = !effects.isReversed;
    setEffects(prev => ({ ...prev, isReversed: newReverseState }));
    
    if (isPlaying) {
      audioEngine.stop();
      // Small timeout to allow stop to process
      setTimeout(() => {
        audioEngine.play({ ...effects, isReversed: newReverseState }, () => setIsPlaying(false));
      }, 50);
    }
  };

  const handleExport = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const blob = await audioEngine.exportAudio(effects);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reson8-remix-${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Failed to export.");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetEffects = () => {
    setEffects({
      pitch: 0,
      echoDelay: 0,
      echoFeedback: 0,
      isReversed: false
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 relative overflow-hidden bg-slate-950">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-600/10 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2 pointer-events-none"></div>

      {/* Header / Logo */}
      <header className="w-full max-w-4xl flex justify-between items-center mb-8 z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-tr from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Volume2 className="text-white w-6 h-6" />
            </div>
            {isPlaying && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Reson8
            </h1>
            <p className="text-xs text-slate-500 font-mono">AUDIO LABORATORY</p>
          </div>
        </div>
        
        <button 
           onClick={() => window.open('https://github.com', '_blank')}
           className="text-slate-400 hover:text-white transition-colors"
        >
          <div className="w-8 h-8 rounded-full border border-slate-700 flex items-center justify-center">
            <span className="font-bold text-xs">R8</span>
          </div>
        </button>
      </header>

      {/* Main Work Area */}
      <main className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 z-10">
        
        {/* Left Column: Visuals & Playback */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Visualizer Card */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-1 rounded-2xl shadow-2xl">
            <div className="relative rounded-xl overflow-hidden bg-slate-950">
               <Visualizer analyser={audioEngine.analyser} isPlaying={isPlaying} />
               {!file && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-4">
                    <Sparkles className="w-8 h-8 opacity-50" />
                    <p className="text-sm">Upload audio to visualize</p>
                 </div>
               )}
            </div>
          </div>

          {/* Transport Controls */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 p-6 rounded-2xl flex flex-col gap-4 shadow-xl">
             <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Track</span>
                  <span className="text-white font-medium truncate max-w-[200px] md:max-w-[300px]">
                    {file ? file.name : "No file selected"}
                  </span>
                </div>
                <div>
                   <input 
                    type="file" 
                    accept="audio/*" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                   />
                   <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-all"
                   >
                     <Upload size={16} /> Load Audio
                   </button>
                </div>
             </div>

             <div className="h-px bg-slate-800 w-full" />

             <div className="flex justify-center items-center gap-6">
                <button 
                  onClick={handleStop}
                  disabled={!file}
                  className="p-4 rounded-full text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                   <div className="w-4 h-4 bg-current rounded-sm" />
                </button>

                <button 
                  onClick={togglePlay}
                  disabled={!file}
                  className="p-6 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {isPlaying ? <Pause fill="white" /> : <Play fill="white" className="ml-1" />}
                </button>

                <button 
                  onClick={handleExport}
                  disabled={!file || isProcessing}
                  className="p-4 rounded-full text-slate-400 hover:bg-slate-800 hover:text-green-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                   {isProcessing ? <div className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full" /> : <Download size={20} />}
                </button>
             </div>
          </div>
        </div>

        {/* Right Column: Effects */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 p-6 rounded-2xl h-full shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Zap className="text-yellow-400 w-5 h-5" /> Effects Rack
              </h2>
              <button 
                onClick={resetEffects} 
                className="text-xs text-slate-500 hover:text-white flex items-center gap-1 transition-colors"
              >
                <RotateCcw size={12} /> Reset
              </button>
            </div>

            {/* Pitch */}
            <EffectControl 
              label="Pitch Shift"
              value={effects.pitch}
              min={-1200}
              max={1200}
              step={100}
              unit=" cents"
              onChange={(val) => setEffects(prev => ({ ...prev, pitch: val }))}
              disabled={!file}
            />

            {/* Echo Delay */}
            <EffectControl 
              label="Echo Delay"
              value={effects.echoDelay}
              min={0}
              max={2}
              step={0.1}
              unit="s"
              onChange={(val) => setEffects(prev => ({ ...prev, echoDelay: val }))}
              disabled={!file}
            />

            {/* Echo Feedback */}
            <EffectControl 
              label="Echo Feedback"
              value={effects.echoFeedback}
              min={0}
              max={0.9}
              step={0.05}
              onChange={(val) => setEffects(prev => ({ ...prev, echoFeedback: val }))}
              disabled={!file}
            />

            {/* Reverse Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700 mt-6">
               <span className="text-sm font-medium text-slate-300 uppercase tracking-wide">Reverse Playback</span>
               <button
                 onClick={toggleReverse}
                 disabled={!file}
                 className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 focus:outline-none ${effects.isReversed ? 'bg-purple-600' : 'bg-slate-700'} ${!file ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
               >
                 <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${effects.isReversed ? 'translate-x-6' : 'translate-x-0'}`} />
               </button>
            </div>

            {/* Info Box */}
            <div className="mt-8 p-4 rounded-lg bg-blue-950/20 border border-blue-900/50">
               <p className="text-xs text-blue-300/80 leading-relaxed text-center">
                 Tips: Adjust pitch to change voice depth. Add delay for space. Toggle reverse for spooky effects. Export saves the processed result.
               </p>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default App;