import axios from 'axios';

const API_URL = 'http://localhost:5000/api/reviews';

export const createReview = async (reviewData: any) => {
  const { data } = await axios.post(API_URL, reviewData);
  return data;
};

export const getLawyerReviews = async (lawyerId: string | number) => {
  const { data } = await axios.get(API_URL, { params: { lawyerId } });
  return data;
};
