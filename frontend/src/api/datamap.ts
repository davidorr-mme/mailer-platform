import client from './client';
import { AttributeDefinition, EventDefinition } from '../types';

export const datamapApi = {
  getAttributes: async (): Promise<AttributeDefinition[]> => {
    const res = await client.get('/attributes');
    return res.data.data;
  },
  createAttribute: async (name: string, dataType: string): Promise<AttributeDefinition> => {
    const res = await client.post('/attributes', { name, dataType });
    return res.data.data;
  },
  updateAttribute: async (id: string, name: string): Promise<AttributeDefinition> => {
    const res = await client.put(`/attributes/${id}`, { name });
    return res.data.data;
  },
  deleteAttribute: async (id: string): Promise<void> => {
    await client.delete(`/attributes/${id}`);
  },

  getEvents: async (): Promise<EventDefinition[]> => {
    const res = await client.get('/event-definitions');
    return res.data.data;
  },
  createEvent: async (name: string, description: string): Promise<EventDefinition> => {
    const res = await client.post('/event-definitions', { name, description });
    return res.data.data;
  },
  updateEvent: async (id: string, name: string, description: string): Promise<EventDefinition> => {
    const res = await client.put(`/event-definitions/${id}`, { name, description });
    return res.data.data;
  },
  deleteEvent: async (id: string): Promise<void> => {
    await client.delete(`/event-definitions/${id}`);
  },
};
