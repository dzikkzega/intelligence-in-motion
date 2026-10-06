export interface EnvironmentOptions {
  reducedMotion?: boolean;
  onProgress?: (progress: number) => void;
  onContextLost?: () => void;
}

export interface EnvironmentInstance {
  render: (time: number, pointer?: { x: number; y: number }, lobby?: boolean) => void;
  resize: () => void;
  setReducedMotion: (value: boolean) => void;
  dispose: () => void;
}

export function createEnvironment(
  canvas: HTMLCanvasElement,
  options?: EnvironmentOptions
): Promise<EnvironmentInstance>;
