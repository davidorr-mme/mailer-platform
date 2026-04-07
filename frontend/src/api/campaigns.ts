import client from './client';
import { Campaign, PaginatedResponse } from '../types';

export const campaignsApi = {
  getCampaigns: async (page = 1, pageSize = 20, status?: string): Promise<PaginatedResponse<Campaign>> => {
    const res = await client.get('/campaigns', { params: { page, pageSize, status } });
    return res.data.data;
  },
  getCampaign: async (id: string): Promise<Campaign> => {
    const res = await client.get(`/campaigns/${id}`);
    return res.data.data;
  },
  createCampaign: async (data: Partial<Campaign>): Promise<Campaign> => {
    const res = await client.post('/campaigns', data);
    return res.data.data;
  },
  updateCampaign: async (id: string, data: Partial<Campaign>): Promise<Campaign> => {
    const res = await client.put(`/campaigns/${id}`, data);
    return res.data.data;
  },
  deleteCampaign: async (id: string): Promise<void> => {
    await client.delete(`/campaigns/${id}`);
  },
  sendCampaign: async (id: string): Promise<void> => {
    await client.post(`/campaigns/${id}/send`);
  },
  scheduleCampaign: async (id: string, scheduledAt: string): Promise<Campaign> => {
    const res = await client.post(`/campaigns/${id}/schedule`, { scheduledAt });
    return res.data.data;
  },
  duplicateCampaign: async (id: string): Promise<Campaign> => {
    const res = await client.post(`/campaigns/${id}/duplicate`);
    return res.data.data;
  },
};
