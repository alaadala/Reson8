export interface AudioState {
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  buffer: AudioBuffer | null;
  fileName: string | null;
}

export interface AudioEffects {
  pitch: number; // -1200 to 1200 cents
  echoDelay: number; // 0 to 1 seconds
  echoFeedback: number; // 0 to 0.9
  isReversed: boolean;
}