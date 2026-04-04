import client from './client';

export const createBooking = async (bookingData: any) => {
  const { data } = await client.post('/bookings', bookingData);
  return data;
};

export const getUserBookings = async (userId: string | number) => {
  const { data } = await client.get('/bookings', { params: { userId } });
  return data;
};

export const updateBookingStatus = async (id: string, status: string) => {
  const { data } = await client.patch(`/bookings/${id}/status`, { status });
  return data;
};
