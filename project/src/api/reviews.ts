import client from './client';

export const createReview = async (reviewData: any) => {
  const { data } = await client.post('/reviews', reviewData);
  return data;
};

export const getLawyerReviews = async (lawyerId: string | number) => {
  const { data } = await client.get('/reviews', { params: { lawyerId } });
  return data;
};
