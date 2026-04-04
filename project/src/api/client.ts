import axios from 'axios';
import { auth } from '../utils/firebase';

const client = axios.create({
  baseURL: 'http://localhost:5000/api',
});

client.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default client;
