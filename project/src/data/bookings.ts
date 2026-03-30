export type BookingStatus = "pending" | "confirmed" | "rejected" | "completed";

export interface Booking {
  id: string;
  lawyerId: number;
  lawyer: string;
  date: string;
  time: string;
  cost: number;
  status: BookingStatus;
  userReview?: {
    rating: number;
    comment: string;
  };
}

export const mockBookings: Booking[] = [
  {
    id: "BK001",
    lawyerId: 1,
    lawyer: "Adv. Priya Sharma",
    date: "2025-07-18",
    time: "11:00 AM",
    cost: 799,
    status: "confirmed",
  },
  {
    id: "BK002",
    lawyerId: 4,
    lawyer: "Adv. Vikram Nair",
    date: "2025-07-25",
    time: "3:00 PM",
    cost: 1999,
    status: "pending",
  },
  {
    id: "BK003",
    lawyerId: 3,
    lawyer: "Adv. Sanya Iyer",
    date: "2025-07-10",
    time: "10:00 AM",
    cost: 599,
    status: "completed",
  },
  {
    id: "BK004",
    lawyerId: 5,
    lawyer: "Adv. Deepa Kulkarni",
    date: "2025-06-28",
    time: "2:00 PM",
    cost: 999,
    status: "completed",
    userReview: {
      rating: 5,
      comment: "Excellent session! Very helpful and knowledgeable.",
    },
  },
  {
    id: "BK005",
    lawyerId: 2,
    lawyer: "Adv. Rahul Mehta",
    date: "2025-06-15",
    time: "4:00 PM",
    cost: 1299,
    status: "rejected",
  },
];
