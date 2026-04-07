import client from './client';
import { ImportHistory, PaginatedResponse } from '../types';

export const importsApi = {
  uploadFile: async (file: File): Promise<{ columns: string[]; preview: any[][] }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await client.post('/imports/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },
  executeImport: async (formData: FormData): Promise<any> => {
    const res = await client.post('/imports/execute', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },
  getImportHistory: async (page = 1, pageSize = 20): Promise<PaginatedResponse<ImportHistory>> => {
    const res = await client.get('/imports/history', { params: { page, pageSize } });
    return res.data.data;
  },
  downloadErrors: async (id: string): Promise<any> => {
    const res = await client.get(`/imports/${id}/errors`);
    return res.data.data;
  },
};
