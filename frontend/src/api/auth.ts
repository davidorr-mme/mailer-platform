import client from './client';

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await client.post('/auth/login', { email, password });
    return res.data.data as { token: string; user: { id: string; email: string } };
  },
  me: async () => {
    const res = await client.get('/auth/me');
    return res.data.data;
  },
};
