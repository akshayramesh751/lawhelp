import axios from 'axios';

const API_URL = 'http://localhost:5000/api/bookings';

export const createBooking = async (bookingData: any) => {
  const { data } = await axios.post(API_URL, bookingData);
  return data;
};

export const getUserBookings = async (userId: string | number) => {
  const { data } = await axios.get(API_URL, { params: { userId } });
  return data;
};

export const updateBookingStatus = async (id: string, status: string) => {
  const { data } = await axios.patch(`${API_URL}/${id}/status`, { status });
  return data;
};
