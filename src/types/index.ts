export interface Summary {
  overview: string;
  keyPoints: string[];
  decisions: string[];
  nextSteps: string[];
}

export interface Task {
  id: string;
  text: string;
  assignee?: string;
  done: boolean;
}

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
  tasks?: Task[];
  summary?: Summary;
}
