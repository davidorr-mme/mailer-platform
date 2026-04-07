import client from './client';
import { Automation, PaginatedResponse } from '../types';

export const automationsApi = {
  getAutomations: async (page = 1, pageSize = 20): Promise<PaginatedResponse<Automation>> => {
    const res = await client.get('/automations', { params: { page, pageSize } });
    return res.data.data;
  },
  getAutomation: async (id: string): Promise<Automation> => {
    const res = await client.get(`/automations/${id}`);
    return res.data.data;
  },
  createAutomation: async (data: Partial<Automation>): Promise<Automation> => {
    const res = await client.post('/automations', data);
    return res.data.data;
  },
  updateAutomation: async (id: string, data: Partial<Automation>): Promise<Automation> => {
    const res = await client.put(`/automations/${id}`, data);
    return res.data.data;
  },
  deleteAutomation: async (id: string): Promise<void> => {
    await client.delete(`/automations/${id}`);
  },
  activateAutomation: async (id: string): Promise<Automation> => {
    const res = await client.post(`/automations/${id}/activate`);
    return res.data.data;
  },
  pauseAutomation: async (id: string): Promise<Automation> => {
    const res = await client.post(`/automations/${id}/pause`);
    return res.data.data;
  },
  duplicateAutomation: async (id: string): Promise<Automation> => {
    const res = await client.post(`/automations/${id}/duplicate`);
    return res.data.data;
  },
};
