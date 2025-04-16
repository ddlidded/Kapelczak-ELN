// Global window type extension
declare global {
  interface Window {
    handleCKEditorImageUpload: (file: File) => Promise<{default: string}>;
    currentNoteId?: number;
  }
}

export {};