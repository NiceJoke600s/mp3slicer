export interface ProcessedFile {
  id: string;
  originalName: string;
  newName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  blob?: Blob;
  errorMsg?: string;
  duration?: number;
  startTime?: number;
  fileObject?: File;
}

export interface AppState {
  files: ProcessedFile[];
  prefix: string;
  isProcessing: boolean;
  progress: number;
}

// Lamejs does not have official @types for the version often used in browser directly, 
// so we define a minimal interface for usage.
export interface LameEncoder {
  encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
  flush(): Int8Array;
}

export enum Step {
  UPLOAD = 'UPLOAD',
  CONFIG = 'CONFIG',
  PROCESSING = 'PROCESSING',
  FINISHED = 'FINISHED'
}