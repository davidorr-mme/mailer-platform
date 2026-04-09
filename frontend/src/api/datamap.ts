import client from './client';
import { AttributeDefinition, EventDefinition } from '../types';

export const datamapApi = {
  getAttributes: async (): Promise<AttributeDefinition[]> => {
    const res = await client.get('/datamap/attributes');
    return res.data.data;
  },
  createAttribute: async (name: string, dataType: string): Promise<AttributeDefinition> => {
    const res = await client.post('/datamap/attributes', { name, dataType });
    return res.data.data;
  },
  updateAttribute: async (id: string, name: string): Promise<AttributeDefinition> => {
    const res = await client.put(`/datamap/attributes/${id}`, { name });
    return res.data.data;
  },
  deleteAttribute: async (id: string): Promise<void> => {
    await client.delete(`/datamap/attributes/${id}`);
  },

  getEvents: async (): Promise<EventDefinition[]> => {
    const res = await client.get('/datamap/events');
    return res.data.data;
  },
  createEvent: async (name: string, description: string): Promise<EventDefinition> => {
    const res = await client.post('/datamap/events', { name, description });
    return res.data.data;
  },
  updateEvent: async (id: string, name: string, description: string): Promise<EventDefinition> => {
    const res = await client.put(`/datamap/events/${id}`, { name, description });
    return res.data.data;
  },
  deleteEvent: async (id: string): Promise<void> => {
    await client.delete(`/datamap/events/${id}`);
  },
};
