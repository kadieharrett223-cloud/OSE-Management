// Type definitions for Chinese PO Files

export interface ChinesePOFile {
  id: string;
  created_at: string;
  updated_at: string;
  purchase_order_id: string;
  file_name: string;
  file_size: number | null;
  file_mime_type: string | null;
  file_path: string;
  file_uploaded_at: string;
  upload_notes: string | null;
  created_by_user_id: string | null;
}

export interface CreateChinesePOFileInput {
  file: File;
  uploadNotes?: string;
}

export interface UploadPOFileResponse {
  ok: boolean;
  data: ChinesePOFile;
  message: string;
}

export interface FetchPOFilesResponse {
  ok: boolean;
  data: ChinesePOFile[];
}
