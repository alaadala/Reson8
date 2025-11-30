import { AudioEffects } from '../types';

export class AudioEngine {
  private audioContext: AudioContext;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private analyserNode: AnalyserNode;
  
  // Effect Nodes
  private delayNode: DelayNode;
  private feedbackNode: GainNode;

  private currentBuffer: AudioBuffer | null = null;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private isPlaying: boolean = false;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Master Gain
    this.gainNode = this.audioContext.createGain();
    
    // Analyser for Visuals
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;

    // Effects Setup
    this.delayNode = this.audioContext.createDelay(5.0); // Max 5 sec delay
    this.feedbackNode = this.audioContext.createGain();

    // Wiring:
    // Source -> [Split] -> Dry (Gain) -> Analyser -> Dest
    //             |
    //             -> Delay -> Feedback -> Delay
    //             -> Delay -> Gain -> Analyser -> Dest
  }

  get context() {
    return this.audioContext;
  }

  get analyser() {
    return this.analyserNode;
  }

  async loadFile(file: File): Promise<AudioBuffer> {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this.currentBuffer = audioBuffer;
    return audioBuffer;
  }

  private createSource(effects: AudioEffects): AudioBufferSourceNode {
    if (!this.currentBuffer) throw new Error("No buffer loaded");

    const source = this.audioContext.createBufferSource();
    
    // Handle Reverse Manually (Non-destructive to original, but we clone for playback)
    // For true reverse playback in Web Audio without playbackRate -1 issues, 
    // we reverse the buffer data.
    if (effects.isReversed) {
      const reversedBuffer = this.cloneBuffer(this.currentBuffer);
      for (let i = 0; i < reversedBuffer.numberOfChannels; i++) {
        Array.prototype.reverse.call(reversedBuffer.getChannelData(i));
      }
      source.buffer = reversedBuffer;
    } else {
      source.buffer = this.currentBuffer;
    }

    // Pitch (Detune)
    source.detune.value = effects.pitch;

    return source;
  }

  private cloneBuffer(buffer: AudioBuffer): AudioBuffer {
    const newBuffer = this.audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      newBuffer.copyToChannel(buffer.getChannelData(i), i);
    }
    return newBuffer;
  }

  play(effects: AudioEffects, onEnded: () => void) {
    if (this.isPlaying) this.stop();
    if (!this.currentBuffer) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.sourceNode = this.createSource(effects);

    // Apply Echo parameters
    this.delayNode.delayTime.value = effects.echoDelay;
    this.feedbackNode.gain.value = effects.echoFeedback;

    // Connect Graph
    // Source -> Main Gain -> Analyser -> Dest
    this.sourceNode.connect(this.gainNode);
    
    // Source -> Delay -> Feedback -> Delay (Loop)
    this.sourceNode.connect(this.delayNode);
    this.delayNode.connect(this.feedbackNode);
    this.feedbackNode.connect(this.delayNode);
    
    // Delay -> Main Gain (Mix wet signal in)
    this.delayNode.connect(this.gainNode);

    // Final Output
    this.gainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.audioContext.destination);

    this.startTime = this.audioContext.currentTime - this.pauseTime;
    this.sourceNode.start(0, this.pauseTime);
    this.isPlaying = true;

    this.sourceNode.onended = () => {
      this.isPlaying = false;
      this.pauseTime = 0;
      onEnded();
    };
  }

  pause() {
    if (this.sourceNode && this.isPlaying) {
      this.sourceNode.stop();
      this.pauseTime = this.audioContext.currentTime - this.startTime;
      this.isPlaying = false;
    }
  }

  stop() {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    }
    this.pauseTime = 0;
    this.isPlaying = false;
  }

  updateEffects(effects: AudioEffects) {
    if (this.delayNode) {
      this.delayNode.delayTime.setTargetAtTime(effects.echoDelay, this.audioContext.currentTime, 0.1);
    }
    if (this.feedbackNode) {
      this.feedbackNode.gain.setTargetAtTime(effects.echoFeedback, this.audioContext.currentTime, 0.1);
    }
    if (this.sourceNode && this.isPlaying) {
      this.sourceNode.detune.setTargetAtTime(effects.pitch, this.audioContext.currentTime, 0.1);
    }
  }

  // Render to file (Offline Processing)
  async exportAudio(effects: AudioEffects): Promise<Blob> {
    if (!this.currentBuffer) throw new Error("No audio to export");

    // Estimate duration (Source duration + Echo decay tail)
    const duration = this.currentBuffer.duration + (effects.echoFeedback > 0 ? 3 : 0);
    
    const offlineCtx = new OfflineAudioContext(
      this.currentBuffer.numberOfChannels,
      duration * this.currentBuffer.sampleRate,
      this.currentBuffer.sampleRate
    );

    // Re-create graph in offline context
    const source = offlineCtx.createBufferSource();
    
    // Reverse Logic for Offline
    if (effects.isReversed) {
      const reversedBuffer = this.cloneBuffer(this.currentBuffer);
      for (let i = 0; i < reversedBuffer.numberOfChannels; i++) {
        Array.prototype.reverse.call(reversedBuffer.getChannelData(i));
      }
      source.buffer = reversedBuffer;
    } else {
      source.buffer = this.currentBuffer;
    }

    source.detune.value = effects.pitch;

    const delay = offlineCtx.createDelay(5.0);
    delay.delayTime.value = effects.echoDelay;

    const feedback = offlineCtx.createGain();
    feedback.gain.value = effects.echoFeedback;

    const master = offlineCtx.createGain();

    // Connect
    source.connect(master); // Dry
    source.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(master); // Wet

    master.connect(offlineCtx.destination);

    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    return this.bufferToWave(renderedBuffer, renderedBuffer.length);
  }

  // Helper to convert AudioBuffer to WAV Blob
  private bufferToWave(abuffer: AudioBuffer, len: number) {
    let numOfChan = abuffer.numberOfChannels,
        length = len * numOfChan * 2 + 44,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

    // write WAVE header
    setUint32(0x46464952);                         // "RIFF"
    setUint32(length - 8);                         // file length - 8
    setUint32(0x45564157);                         // "WAVE"

    setUint32(0x20746d66);                         // "fmt " chunk
    setUint32(16);                                 // length = 16
    setUint16(1);                                  // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2);                      // block-align
    setUint16(16);                                 // 16-bit (hardcoded in this example)

    setUint32(0x61746164);                         // "data" - chunk
    setUint32(length - pos - 4);                   // chunk length

    // write interleaved data
    for(i = 0; i < abuffer.numberOfChannels; i++)
      channels.push(abuffer.getChannelData(i));

    while(pos < len) {
      for(i = 0; i < numOfChan; i++) {             // interleave channels
        sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
        view.setInt16(44 + offset, sample, true);  // write 16-bit sample
        offset += 2;
      }
      pos++;
    }

    return new Blob([buffer], {type: "audio/wav"});

    function setUint16(data: number) {
      view.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data: number) {
      view.setUint32(pos, data, true);
      pos += 4;
    }
  }
}