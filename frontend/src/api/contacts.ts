import client from './client';
import { Contact, CustomEvent, CampaignSend, PaginatedResponse } from '../types';

export const contactsApi = {
  searchContact: async (email: string): Promise<Contact | null> => {
    const res = await client.get('/contacts/search', { params: { email } });
    return res.data.data;
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
};
