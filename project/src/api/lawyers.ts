import client from './client';

export const getLawyers = async (filters: any) => {
  const { data } = await client.get('/lawyers', { params: filters });
  return data;
};

export const getLawyerById = async (id: string | number) => {
  const { data } = await client.get(`/lawyers/${id}`);
  return data;
};
