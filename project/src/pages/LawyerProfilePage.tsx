import { useState, useEffect } from "react";
import {
  MapPin,
  Languages,
  GraduationCap,
  Scale,
  Award,
  Briefcase,
  ArrowLeft,
} from "lucide-react";
import { getLawyerById } from "../api/lawyers";
import { createBooking } from "../api/bookings";
import StarRating from "../components/StarRating";

interface LawyerProfilePageProps {
  lawyerId: number;
  onNavigate: (page: string, data?: { lawyerId?: number; slot?: string }) => void;
}

export default function LawyerProfilePage({
  lawyerId,
  onNavigate,
}: LawyerProfilePageProps) {
  const [lawyer, setLawyer] = useState<any>(null);
  const [lawyerReviews, setLawyerReviews] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "reviews" | "availability">("overview");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const TEST_USER_ID = "670a7a4dd4bfb22221234567";

  useEffect(() => {
    const fetchLawyerData = async () => {
      try {
        const { lawyer, reviews } = await getLawyerById(lawyerId);
        setLawyer({ ...lawyer, id: lawyer._id, reviews: lawyer.totalReviews });
        setLawyerReviews(reviews || []);
      } catch (error) {
        console.error("Failed to fetch lawyer details", error);
      }
    };
    fetchLawyerData();
  }, [lawyerId]);

  if (!lawyer) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    return parts
      .slice(1, 3)
      .map((p) => p[0])
      .join("");
  };

  const colors = [
    "bg-blue-600",
    "bg-green-600",
    "bg-purple-600",
    "bg-red-600",
    "bg-yellow-600",
  ];
  const colorIndex = lawyer.id % colors.length;

  const weekSlots = [
    { day: "Mon", date: "Jul 29", slots: ["10:00 AM", "2:00 PM", "4:00 PM"] },
    { day: "Tue", date: "Jul 30", slots: ["11:00 AM", "3:00 PM"] },
    { day: "Wed", date: "Jul 31", slots: ["10:00 AM", "1:00 PM", "5:00 PM"] },
    { day: "Thu", date: "Aug 1", slots: ["9:00 AM", "2:00 PM"] },
    { day: "Fri", date: "Aug 2", slots: ["10:00 AM", "11:00 AM", "3:00 PM", "4:00 PM"] },
  ];

  const handleBooking = async () => {
    if (selectedSlot && lawyer) {
      setIsBooking(true);
      try {
        // "Jul 29-10:00 AM" example selectedSlot format. Wait, let's just pass the slot string and split it.
        // It relies on index of '-', actually weekSlots id is date-slot  (e.g., Jul 29-10:00 AM)
        const dashIndex = selectedSlot.indexOf('-');
        const dateString = selectedSlot.substring(0, dashIndex);
        const timeString = selectedSlot.substring(dashIndex + 1);
        
        await createBooking({
          userId: TEST_USER_ID,
          lawyerId: lawyer.id,
          date: new Date(`${dateString} 2026`),
          timeSlot: timeString,
          cost: lawyer.cost
        });
        onNavigate("booking-confirm", { lawyerId: lawyer.id, slot: selectedSlot });
      } catch (error) {
        console.error("Booking failed", error);
      } finally {
        setIsBooking(false);
      }
    }
  };

  return (
    <div className="min-h-screen pt-16 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => onNavigate("listing")}
          className="flex items-center gap-2 text-gray-400 hover:text-gold transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Listings
        </button>

        <div className="bg-navy-50 rounded-2xl border border-gray-800 p-8 mb-6 fade-in">
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div
              className={`${colors[colorIndex]} w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-2xl flex-shrink-0`}
            >
              {getInitials(lawyer.name)}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-serif font-bold text-white mb-3">
                {lawyer.name}
              </h1>
              <div className="flex flex-wrap gap-2 mb-4">
                {lawyer.specializations.map((spec: string) => (
                  <span
                    key={spec}
                    className="px-3 py-1 bg-gold/10 text-gold text-sm rounded-lg border border-gold/20"
                  >
                    {spec}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-gray-300">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-gold" />
                  <span>{lawyer.city}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-gold" />
                  <span>{lawyer.experience} years experience</span>
                </div>
                <div className="flex items-center gap-2">
                  <StarRating rating={lawyer.rating} size="sm" />
                  <span>
                    {lawyer.rating} ({lawyer.reviews} reviews)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Languages className="w-5 h-5 text-gold" />
                  <span>{lawyer.languages.join(", ")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-navy-50 rounded-2xl border border-gray-800 overflow-hidden slide-up">
              <div className="flex border-b border-gray-800">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                    activeTab === "overview"
                      ? "bg-gold/10 text-gold border-b-2 border-gold"
                      : "text-gray-400 hover:text-gold"
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab("reviews")}
                  className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                    activeTab === "reviews"
                      ? "bg-gold/10 text-gold border-b-2 border-gold"
                      : "text-gray-400 hover:text-gold"
                  }`}
                >
                  Reviews
                </button>
                <button
                  onClick={() => setActiveTab("availability")}
                  className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                    activeTab === "availability"
                      ? "bg-gold/10 text-gold border-b-2 border-gold"
                      : "text-gray-400 hover:text-gold"
                  }`}
                >
                  Availability
                </button>
              </div>

              <div className="p-6">
                {activeTab === "overview" && (
                  <div className="space-y-6 fade-in">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-3">About</h3>
                      <p className="text-gray-300 leading-relaxed">{lawyer.bio}</p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="bg-navy rounded-xl p-4 border border-gray-800">
                        <div className="flex items-center gap-3 mb-2">
                          <GraduationCap className="w-5 h-5 text-gold" />
                          <h4 className="font-semibold text-white">Education</h4>
                        </div>
                        <p className="text-gray-300 text-sm">{lawyer.education}</p>
                      </div>

                      <div className="bg-navy rounded-xl p-4 border border-gray-800">
                        <div className="flex items-center gap-3 mb-2">
                          <Scale className="w-5 h-5 text-gold" />
                          <h4 className="font-semibold text-white">Bar Registration</h4>
                        </div>
                        <p className="text-gray-300 text-sm">{lawyer.barReg}</p>
                      </div>

                      <div className="bg-navy rounded-xl p-4 border border-gray-800">
                        <div className="flex items-center gap-3 mb-2">
                          <Award className="w-5 h-5 text-gold" />
                          <h4 className="font-semibold text-white">Win Rate</h4>
                        </div>
                        <p className="text-2xl font-bold text-gold">
                          {lawyer.winRate}%
                        </p>
                      </div>

                      <div className="bg-navy rounded-xl p-4 border border-gray-800">
                        <div className="flex items-center gap-3 mb-2">
                          <Briefcase className="w-5 h-5 text-gold" />
                          <h4 className="font-semibold text-white">Cases Handled</h4>
                        </div>
                        <p className="text-2xl font-bold text-gold">
                          {lawyer.casesHandled}+
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "reviews" && (
                  <div className="space-y-4 fade-in">
                    {lawyerReviews.length > 0 ? (
                      lawyerReviews.map((review) => (
                        <div
                          key={review.id}
                          className="bg-navy rounded-xl p-4 border border-gray-800"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-white">
                                {review.reviewerName}
                              </p>
                              <p className="text-sm text-gray-400">
                                {new Date(review.date).toLocaleDateString("en-IN", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </p>
                            </div>
                            <StarRating rating={review.rating} size="sm" />
                          </div>
                          <p className="text-gray-300">{review.comment}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-400 text-center py-8">
                        No reviews yet
                      </p>
                    )}
                  </div>
                )}

                {activeTab === "availability" && (
                  <div className="fade-in">
                    <h3 className="text-xl font-bold text-white mb-4">
                      Available Slots
                    </h3>
                    <div className="space-y-4">
                      {weekSlots.map((dayData) => (
                        <div key={dayData.day}>
                          <h4 className="text-sm font-semibold text-gray-400 mb-2">
                            {dayData.day}, {dayData.date}
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {dayData.slots.map((slot) => {
                              const slotId = `${dayData.date}-${slot}`;
                              return (
                                <button
                                  key={slot}
                                  onClick={() => setSelectedSlot(slotId)}
                                  className={`px-4 py-2 rounded-lg border transition-all ${
                                    selectedSlot === slotId
                                      ? "bg-gold text-navy border-gold font-semibold"
                                      : "bg-navy border-gray-700 text-gray-300 hover:border-gold"
                                  }`}
                                >
                                  {slot}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-navy-50 rounded-2xl border border-gray-800 p-6 sticky top-24 slide-up">
              <h3 className="text-xl font-serif font-bold text-gold mb-4">
                Book a Session
              </h3>

              {selectedSlot ? (
                <div className="bg-navy rounded-xl p-4 border border-gray-800 mb-4">
                  <p className="text-sm text-gray-400 mb-1">Selected Slot</p>
                  <p className="text-white font-semibold">{selectedSlot}</p>
                </div>
              ) : (
                <div className="bg-navy rounded-xl p-4 border border-gray-800 mb-4">
                  <p className="text-sm text-gray-400 text-center">
                    Select a slot from the Availability tab
                  </p>
                </div>
              )}

              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-400">Session Cost</span>
                  <span className="text-white font-semibold">₹{lawyer.cost}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Platform Fee</span>
                  <span className="text-white font-semibold">₹0</span>
                </div>
                <div className="border-t border-gray-800 pt-3 flex justify-between">
                  <span className="text-white font-bold">Total</span>
                  <span className="text-gold font-bold text-xl">
                    ₹{lawyer.cost}
                  </span>
                </div>
              </div>

              <button
                onClick={handleBooking}
                disabled={!selectedSlot || isBooking}
                className={`w-full py-3 rounded-lg font-bold transition-all ${
                  selectedSlot
                    ? "bg-gold hover:bg-gold-500 text-navy hover:shadow-lg hover:shadow-gold/20"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                }`}
              >
                {isBooking ? "Confirming..." : "Confirm Booking"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
