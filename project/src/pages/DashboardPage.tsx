import { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Star as StarIcon,
  Sparkles,
  LayoutDashboard,
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
  userReview?: { rating: number; comment: string };
}

interface DashboardPageProps {
  onNavigate: (page: string) => void;
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [activeTab, setActiveTab] = useState<"bookings" | "reviews">("bookings");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const TEST_USER_ID = "670a7a4dd4bfb22221234567";

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    const fetchBookings = async () => {
      try {
        const data = await getUserBookings(TEST_USER_ID);
        const formatted = data.map((b: any) => ({
          id: b._id, _id: b._id,
          lawyer: b.lawyerId?.name || "Unknown Lawyer",
          lawyerId: b.lawyerId?._id,
          date: new Date(b.date).toLocaleDateString(),
          time: b.timeSlot,
          status: b.status,
          cost: b.cost,
        }));
        setBookings(formatted);
        const hasPending = formatted.some((b: any) => b.status === "pending");
        if (hasPending && !intervalId) intervalId = setInterval(fetchBookings, 5000);
        else if (!hasPending && intervalId) { clearInterval(intervalId); intervalId = null; }
      } catch (error) { console.error("Failed to fetch bookings", error); }
    };
    fetchBookings();
    return () => { if (intervalId) clearInterval(intervalId); };
  }, []);

  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const openRatingModal = (booking: Booking) => {
    setSelectedBooking(booking); setRating(0); setReviewComment(""); setIsRatingModalOpen(true);
  };

  const submitReview = async () => {
    if (selectedBooking && rating > 0) {
      try {
        await createReview({ bookingId: selectedBooking.id, userId: TEST_USER_ID, lawyerId: selectedBooking.lawyerId, rating, comment: reviewComment });
        const updatedBookings = bookings.map((b) =>
          b.id === selectedBooking.id ? { ...b, userReview: { rating, comment: reviewComment } } : b
        );
        setBookings(updatedBookings);
        setIsRatingModalOpen(false);
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
      } catch (error) { console.error("Failed to submit review", error); }
    }
  };

  const statusConfig: Record<string, { label: string; icon: any; bg: string; text: string; dot: string }> = {
    pending: { label: "Pending", icon: Clock, bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
    confirmed: { label: "Confirmed", icon: CheckCircle2, bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
    rejected: { label: "Rejected", icon: XCircle, bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
    completed: { label: "Completed", icon: CheckCircle2, bg: "bg-[#C9A84C]/10", text: "text-[#C9A84C]", dot: "bg-[#C9A84C]" },
  };

  const getStatusBadge = (status: string) => {
    const cfg = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text} border border-current/20`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {cfg.label}
      </span>
    );
  };

  const myReviews = bookings.filter((b) => b.userReview);

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Page Header */}
        <div className="flex items-center gap-3 mb-10 fade-in">
          <LayoutDashboard className="w-5 h-5 text-[#C9A84C]/60" />
          <h1 className="text-3xl font-serif font-bold text-white">My Dashboard</h1>
        </div>

        {/* Success Banner */}
        {showSuccessMessage && (
          <div className="mb-6 flex items-center gap-3 bg-emerald-500/[0.08] border border-emerald-500/20 rounded-xl px-5 py-3.5 fade-in">
            <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-emerald-400 text-sm font-medium">Review submitted!</p>
              <p className="text-xs text-[#dce1fb]/40">Your review helps others find great lawyers.</p>
            </div>
          </div>
        )}

        {/* Tabs + Content */}
        <div className="bg-[#0c1324] rounded-2xl border border-white/[0.05] overflow-hidden slide-up">

          {/* Tab Bar */}
          <div className="flex border-b border-white/[0.05]">
            {(["bookings", "reviews"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-all duration-200 ${activeTab === tab
                    ? "text-[#C9A84C] border-b-2 border-[#C9A84C] bg-[#C9A84C]/[0.03]"
                    : "text-[#dce1fb]/40 hover:text-[#dce1fb]/70"
                  }`}
              >
                {tab === "bookings" ? "My Bookings" : "My Reviews"}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Bookings Tab */}
            {activeTab === "bookings" && (
              <div className="space-y-3 fade-in">
                {bookings.length > 0 ? (
                  bookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="bg-[#151b2d] rounded-xl p-5 hover:bg-[#1a2235] transition-all duration-200"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-base font-semibold text-white mb-0.5">{booking.lawyer}</h3>
                              <p className="text-[10px] uppercase tracking-widest text-[#dce1fb]/25">#{booking.id.slice(-8)}</p>
                            </div>
                            {getStatusBadge(booking.status)}
                          </div>
                          <div className="flex flex-wrap gap-5 text-xs text-[#dce1fb]/40">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-[#C9A84C]/50" />
                              {booking.date}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-[#C9A84C]/50" />
                              {booking.time}
                            </span>
                            <span className="text-[#C9A84C] font-semibold text-sm">₹{booking.cost}</span>
                          </div>
                        </div>

                        {booking.status === "completed" && !booking.userReview && (
                          <button
                            onClick={() => openRatingModal(booking)}
                            className="shrink-0 flex items-center gap-2 bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 text-[#C9A84C] px-4 py-2 rounded-xl text-xs font-medium transition-colors duration-200"
                          >
                            <StarIcon className="w-3.5 h-3.5" />
                            Rate Session
                          </button>
                        )}

                        {booking.userReview && (
                          <div className="shrink-0">
                            <StarRating rating={booking.userReview.rating} size="sm" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16">
                    <Calendar className="w-12 h-12 text-[#dce1fb]/10 mx-auto mb-4" />
                    <p className="text-sm text-[#dce1fb]/30 mb-5">No bookings yet</p>
                    <button
                      onClick={() => onNavigate("listing")}
                      className="bg-[#C9A84C] hover:bg-[#e6c364] text-[#241a00] px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200"
                    >
                      Find a Lawyer
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Reviews Tab */}
            {activeTab === "reviews" && (
              <div className="space-y-3 fade-in">
                {myReviews.length > 0 ? (
                  myReviews.map((booking) => (
                    <div key={booking.id} className="bg-[#151b2d] rounded-xl p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-base font-semibold text-white mb-0.5">{booking.lawyer}</h3>
                          <p className="text-xs text-[#dce1fb]/40">{booking.date} · {booking.time}</p>
                        </div>
                        <StarRating rating={booking.userReview!.rating} size="sm" />
                      </div>
                      {booking.userReview!.comment && (
                        <p className="text-sm text-[#dce1fb]/50 leading-relaxed">{booking.userReview!.comment}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16">
                    <StarIcon className="w-12 h-12 text-[#dce1fb]/10 mx-auto mb-4" />
                    <p className="text-sm text-[#dce1fb]/30">No reviews yet</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rating Modal */}
      <Modal isOpen={isRatingModalOpen} onClose={() => setIsRatingModalOpen(false)} title="Rate Your Session">
        {selectedBooking && (
          <div>
            <div className="mb-6 text-center">
              <p className="text-sm text-[#dce1fb]/50 mb-4">
                How was your session with <span className="font-semibold text-white">{selectedBooking.lawyer}</span>?
              </p>
              <div className="flex justify-center mb-2">
                <StarRating rating={rating} onRatingChange={setRating} interactive={true} size="lg" />
              </div>
              {rating > 0 && (
                <p className="text-xs text-[#C9A84C]">
                  {["", "Poor", "Fair", "Good", "Great!", "Excellent!"][rating]}
                </p>
              )}
            </div>
            <div className="mb-5">
              <label className="block text-[10px] uppercase tracking-widest text-[#C9A84C]/60 mb-2">Your Experience (optional)</label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Tell others about your experience..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl bg-[#070d1f] border border-white/[0.06] text-[#dce1fb] text-sm placeholder-[#dce1fb]/25 focus:outline-none focus:border-[#C9A84C]/40 transition-colors resize-none"
              />
            </div>
            <button
              onClick={submitReview}
              disabled={rating === 0}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 ${rating > 0 ? "bg-[#C9A84C] hover:bg-[#e6c364] text-[#241a00]" : "bg-[#151b2d] text-[#dce1fb]/25 cursor-not-allowed"
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
