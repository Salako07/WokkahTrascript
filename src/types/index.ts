export interface Transcript {
  id: string;
  title: string;
  text: string;
  audioUri?: string;
  duration: number;
  createdAt: string;
  fileSize?: number;
  source: 'recording' | 'upload';
  fileName?: string;
}
