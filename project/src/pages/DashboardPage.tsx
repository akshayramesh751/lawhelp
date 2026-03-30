import { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Star as StarIcon,
  Sparkles,
} from "lucide-react";
import { getUserBookings } from "../api/bookings";
import { createReview } from "../api/reviews";
import Modal from "../components/Modal";
import StarRating from "../components/StarRating";

export interface Booking {
  id: string;
  _id?: string;
  lawyer: string;
  lawyerId: any;
  date: string;
  time: string;
  status: string;
  cost: number;
  userReview?: {
    rating: number;
    comment: string;
  };
}

interface DashboardPageProps {
  onNavigate: (page: string) => void;
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [activeTab, setActiveTab] = useState<"bookings" | "reviews">("bookings");
  const [bookings, setBookings] = useState<Booking[]>([]);
  
  // Use a hardcoded mock user ID for frontend testing since auth isn't set up yet
  const TEST_USER_ID = "670a7a4dd4bfb22221234567"; 

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const data = await getUserBookings(TEST_USER_ID);
        const formatted = data.map((b: any) => ({
          id: b._id,
          _id: b._id,
          lawyer: b.lawyerId?.name || "Unknown Lawyer",
          lawyerId: b.lawyerId?._id,
          date: new Date(b.date).toLocaleDateString(),
          time: b.timeSlot,
          status: b.status,
          cost: b.cost,
        }));
        setBookings(formatted);
      } catch (error) {
        console.error("Failed to fetch bookings", error);
      }
    };
    fetchBookings();
  }, []);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const openRatingModal = (booking: Booking) => {
    setSelectedBooking(booking);
    setRating(0);
    setReviewComment("");
    setIsRatingModalOpen(true);
  };

  const submitReview = async () => {
    if (selectedBooking && rating > 0) {
      try {
        await createReview({
          bookingId: selectedBooking.id,
          userId: TEST_USER_ID,
          lawyerId: selectedBooking.lawyerId,
          rating,
          comment: reviewComment
        });

        const updatedBookings = bookings.map((b) =>
          b.id === selectedBooking.id
            ? { ...b, userReview: { rating, comment: reviewComment } }
            : b
        );
        setBookings(updatedBookings);
        setIsRatingModalOpen(false);
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
      } catch (error) {
        console.error("Failed to submit review", error);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      confirmed: "bg-green-500/10 text-green-500 border-green-500/20",
      rejected: "bg-red-500/10 text-red-500 border-red-500/20",
      completed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    };

    const icons = {
      pending: Clock,
      confirmed: CheckCircle2,
      rejected: XCircle,
      completed: CheckCircle2,
    };

    const Icon = icons[status as keyof typeof icons];

    return (
      <span
        className={`px-3 py-1 rounded-lg border text-sm font-semibold inline-flex items-center gap-2 ${
          styles[status as keyof typeof styles]
        }`}
      >
        <Icon className="w-4 h-4" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const myReviews = bookings.filter((b) => b.userReview);

  return (
    <div className="min-h-screen pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-serif font-bold text-white mb-8 fade-in">
          My Dashboard
        </h1>

        {showSuccessMessage && (
          <div className="mb-6 bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3 fade-in">
            <Sparkles className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-green-500 font-semibold">Thank you!</p>
              <p className="text-sm text-gray-300">
                Your review helps others find great lawyers.
              </p>
            </div>
          </div>
        )}

        <div className="bg-navy-50 rounded-2xl border border-gray-800 overflow-hidden slide-up">
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setActiveTab("bookings")}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === "bookings"
                  ? "bg-gold/10 text-gold border-b-2 border-gold"
                  : "text-gray-400 hover:text-gold"
              }`}
            >
              My Bookings
            </button>
            <button
              onClick={() => setActiveTab("reviews")}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === "reviews"
                  ? "bg-gold/10 text-gold border-b-2 border-gold"
                  : "text-gray-400 hover:text-gold"
              }`}
            >
              My Reviews
            </button>
          </div>

          <div className="p-6">
            {activeTab === "bookings" && (
              <div className="space-y-4 fade-in">
                {bookings.length > 0 ? (
                  bookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="bg-navy rounded-xl p-6 border border-gray-800 hover:border-gold/30 transition-colors"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-xl font-bold text-white mb-1">
                                {booking.lawyer}
                              </h3>
                              <p className="text-sm text-gray-400">
                                Booking ID: {booking.id}
                              </p>
                            </div>
                            {getStatusBadge(booking.status)}
                          </div>

                          <div className="grid sm:grid-cols-3 gap-4 text-sm">
                            <div className="flex items-center gap-2 text-gray-300">
                              <Calendar className="w-4 h-4 text-gold" />
                              <span>{booking.date}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-300">
                              <Clock className="w-4 h-4 text-gold" />
                              <span>{booking.time}</span>
                            </div>
                            <div className="text-gold font-bold">₹{booking.cost}</div>
                          </div>
                        </div>

                        {booking.status === "completed" && !booking.userReview && (
                          <button
                            onClick={() => openRatingModal(booking)}
                            className="bg-gold hover:bg-gold-500 text-navy px-6 py-2 rounded-lg font-semibold transition-all flex items-center gap-2"
                          >
                            <StarIcon className="w-4 h-4" />
                            Rate this Session
                          </button>
                        )}

                        {booking.userReview && (
                          <div className="bg-navy-50 rounded-lg p-3 border border-green-500/20">
                            <p className="text-sm text-gray-400 mb-1">Your Review</p>
                            <StarRating rating={booking.userReview.rating} size="sm" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                    <p className="text-gray-400 mb-4">No bookings yet</p>
                    <button
                      onClick={() => onNavigate("listing")}
                      className="bg-gold hover:bg-gold-500 text-navy px-6 py-3 rounded-lg font-semibold transition-all"
                    >
                      Find a Lawyer
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "reviews" && (
              <div className="space-y-4 fade-in">
                {myReviews.length > 0 ? (
                  myReviews.map((booking) => (
                    <div
                      key={booking.id}
                      className="bg-navy rounded-xl p-6 border border-gray-800"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-white mb-1">
                            {booking.lawyer}
                          </h3>
                          <p className="text-sm text-gray-400">
                            {booking.date} • {booking.time}
                          </p>
                        </div>
                        <StarRating rating={booking.userReview!.rating} size="sm" />
                      </div>
                      {booking.userReview!.comment && (
                        <p className="text-gray-300">{booking.userReview!.comment}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <StarIcon className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                    <p className="text-gray-400">No reviews yet</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={isRatingModalOpen}
        onClose={() => setIsRatingModalOpen(false)}
        title="Rate Your Session"
      >
        {selectedBooking && (
          <div>
            <div className="mb-6 text-center">
              <p className="text-gray-300 mb-4">
                How was your session with{" "}
                <span className="font-semibold text-white">
                  {selectedBooking.lawyer}
                </span>
                ?
              </p>
              <div className="flex justify-center mb-2">
                <StarRating
                  rating={rating}
                  onRatingChange={setRating}
                  interactive={true}
                  size="lg"
                />
              </div>
              {rating > 0 && (
                <p className="text-sm text-gold">
                  {rating === 5
                    ? "Excellent!"
                    : rating === 4
                      ? "Great!"
                      : rating === 3
                        ? "Good"
                        : rating === 2
                          ? "Fair"
                          : "Poor"}
                </p>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Share your experience (optional)
              </label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Tell others about your experience..."
                rows={4}
                className="w-full px-4 py-3 rounded-lg bg-navy border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-gold resize-none"
              />
            </div>

            <button
              onClick={submitReview}
              disabled={rating === 0}
              className={`w-full py-3 rounded-lg font-bold transition-all ${
                rating > 0
                  ? "bg-gold hover:bg-gold-500 text-navy"
                  : "bg-gray-700 text-gray-500 cursor-not-allowed"
              }`}
            >
              Submit Review
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
