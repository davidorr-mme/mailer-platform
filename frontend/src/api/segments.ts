import client from './client';
import { Segment, SegmentLogic, PaginatedResponse } from '../types';

export const segmentsApi = {
  getSegments: async (page = 1, pageSize = 20): Promise<PaginatedResponse<Segment>> => {
    const res = await client.get('/segments', { params: { page, pageSize } });
    return res.data.data;
  },
  getSegment: async (id: string): Promise<Segment> => {
    const res = await client.get(`/segments/${id}`);
    return res.data.data;
  },
  createSegment: async (data: Partial<Segment>): Promise<Segment> => {
    const res = await client.post('/segments', data);
    return res.data.data;
  },
  updateSegment: async (id: string, data: Partial<Segment>): Promise<Segment> => {
    const res = await client.put(`/segments/${id}`, data);
    return res.data.data;
  },
  deleteSegment: async (id: string): Promise<void> => {
    await client.delete(`/segments/${id}`);
  },
  estimateSegment: async (logic: SegmentLogic): Promise<{ count: number }> => {
    const res = await client.post('/segments/estimate', { logic });
    return res.data.data;
  },
  estimateSegmentById: async (id: string): Promise<{ count: number }> => {
    const res = await client.post(`/segments/${id}/estimate`);
    return res.data.data;
  },
  duplicateSegment: async (id: string): Promise<Segment> => {
    const res = await client.post(`/segments/${id}/duplicate`);
    return res.data.data;
  },
    exportSegment: async (id: string, name: string): Promise<void> => {
    const res = await client.get(`/segments/${id}/export`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
