import axios from 'axios';

const API_URL = 'http://localhost:5000/api/lawyers';

export const getLawyers = async (filters: any) => {
  const { data } = await axios.get(API_URL, { params: filters });
  return data;
};

export const getLawyerById = async (id: string | number) => {
  const { data } = await axios.get(`${API_URL}/${id}`);
  return data;
};
