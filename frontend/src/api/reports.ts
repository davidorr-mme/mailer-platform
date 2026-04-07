import client from './client';
import { CampaignReport, PaginatedResponse } from '../types';

export const reportsApi = {
  getCampaignReports: async (page = 1, pageSize = 20): Promise<PaginatedResponse<CampaignReport>> => {
    const res = await client.get('/reports/campaigns', { params: { page, pageSize } });
    return res.data.data;
  },
  getCampaignReport: async (id: string): Promise<CampaignReport> => {
    const res = await client.get(`/reports/campaigns/${id}`);
    return res.data.data;
  },
  getCampaignLinks: async (id: string): Promise<{ url: string; totalClicks: number; uniqueClicks: number; pctOpeners: number }[]> => {
    const res = await client.get(`/reports/campaigns/${id}/links`);
    return res.data.data;
  },
  getCampaignRecipients: async (
    id: string,
    page = 1,
    pageSize = 25,
    status?: string
  ): Promise<PaginatedResponse<any>> => {
    const res = await client.get(`/reports/campaigns/${id}/recipients`, {
      params: { page, pageSize, status },
    });
    return res.data.data;
  },
};
