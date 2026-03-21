export type RecordingCompleteCallback = (trackId: string, blob: Blob) => void;

export class RecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private trackId: string | null = null;
  private chunks: Blob[] = [];
  private recording = false;

  public onComplete: RecordingCompleteCallback | null = null;

  isRecording(): boolean {
    return this.recording;
  }

  getTrackId(): string | null {
    return this.trackId;
  }

  async start(trackId: string): Promise<void> {
    if (this.recording) {
      throw new Error('Already recording');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    this.stream = stream;
    this.trackId = trackId;
    this.chunks = [];
    this.recording = true;

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    this.mediaRecorder = new MediaRecorder(stream, { mimeType });

    this.mediaRecorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: mimeType });
      if (this.onComplete && this.trackId) {
        this.onComplete(this.trackId, blob);
      }
      this.chunks = [];
    };

    this.mediaRecorder.start(100); // collect in 100ms chunks
  }

  stop(): void {
    this.recording = false;
    this.stream?.getTracks().forEach(t => t.stop());
    this.mediaRecorder?.stop();
    this.stream = null;
  }
}

export const recordingService = new RecordingService();
