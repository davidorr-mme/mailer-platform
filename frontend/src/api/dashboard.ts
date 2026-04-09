import client from './client';
import { DashboardKpis, PerformanceDataPoint, Campaign, Automation } from '../types';

export const dashboardApi = {
  getKpis: async (days: number): Promise<DashboardKpis> => {
    const res = await client.get('/dashboard/kpis', { params: { days } });
    return res.data.data;
  },
  getRecentCampaigns: async (): Promise<Campaign[]> => {
    const res = await client.get('/dashboard/recent-campaigns');
    return res.data.data;
  },
  getRecentAutomations: async (): Promise<Automation[]> => {
    const res = await client.get('/dashboard/recent-automations');
    return res.data.data;
  },
  getPerformanceChart: async (days: number): Promise<PerformanceDataPoint[]> => {
    const res = await client.get('/dashboard/performance-chart', { params: { days } });
    return res.data.data;
  },
};
