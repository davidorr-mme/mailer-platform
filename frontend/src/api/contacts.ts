import client from './client';
import { Contact, CustomEvent, CampaignSend, PaginatedResponse } from '../types';

export const contactsApi = {
    searchContact: async (email: string): Promise<Contact | null> => {
    try {
      const res = await client.get('/contacts/search', { params: { email } });
      return res.data.data;
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  },
  getContact: async (id: string): Promise<Contact> => {
    const res = await client.get(`/contacts/${id}`);
    return res.data.data;
  },
  getContactEvents: async (id: string, page = 1, pageSize = 25): Promise<PaginatedResponse<CustomEvent>> => {
    const res = await client.get(`/contacts/${id}/events`, { params: { page, pageSize } });
    return res.data.data;
  },
  getContactCampaignHistory: async (id: string): Promise<CampaignSend[]> => {
    const res = await client.get(`/contacts/${id}/campaign-history`);
    return res.data.data;
  },
      updateContact: async (id: string, data: { email?: string; globalUnsubscribe?: boolean }): Promise<Contact> => {
    const res = await client.put(`/contacts/${id}`, data);
    return res.data.data;
  },
};
