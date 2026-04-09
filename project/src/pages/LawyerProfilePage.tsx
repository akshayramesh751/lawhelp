import { useState, useEffect } from "react";
import {
  MapPin, Languages, GraduationCap, Scale, Award, Briefcase, ArrowLeft, Calendar, Clock,
} from "lucide-react";
import { getLawyerById } from "../api/lawyers";
import { createBooking } from "../api/bookings";
import StarRating from "../components/StarRating";

interface LawyerProfilePageProps {
  lawyerId: number;
  onNavigate: (page: string, data?: { lawyerId?: number; slot?: string }) => void;
}

export default function LawyerProfilePage({ lawyerId, onNavigate }: LawyerProfilePageProps) {
  const [lawyer, setLawyer] = useState<any>(null);
  const [lawyerReviews, setLawyerReviews] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "reviews" | "availability">("overview");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirmedSlots, setConfirmedSlots] = useState<Set<string>>(new Set());
  const [isBooking, setIsBooking] = useState(false);
  const TEST_USER_ID = "670a7a4dd4bfb22221234567";

  useEffect(() => {
    const fetchLawyerData = async () => {
      try {
        const { lawyer, reviews, confirmedBookings } = await getLawyerById(lawyerId);
        setLawyer({ ...lawyer, id: lawyer._id, reviews: lawyer.totalReviews });
        setLawyerReviews(reviews || []);

        if (confirmedBookings) {
          const booked = new Set<string>();
          confirmedBookings.forEach((b: any) => {
            const dateStr = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(b.date));
            booked.add(`${dateStr}-${b.timeSlot}`);
          });
          setConfirmedSlots(booked);
        }
      } catch (error) {
        console.error("Failed to fetch lawyer details", error);
      }
    };
    fetchLawyerData();
  }, [lawyerId]);

  const generateWeekSlots = () => {
    const generatedSlots = [];
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() + 1); // Start from tomorrow

    let daysAdded = 0;
    while (daysAdded < 7) {
      if (currentDate.getDay() !== 0) { // Exclude Sunday
        const day = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(currentDate);
        const dateStr = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(currentDate);
        generatedSlots.push({ day, date: dateStr, slots: ["4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM"] });
        daysAdded++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return generatedSlots;
  };
  const weekSlots = generateWeekSlots();

  const handleBooking = async () => {
    if (selectedSlot && lawyer) {
      setIsBooking(true);
      try {
        const dashIndex = selectedSlot.indexOf("-");
        const dateString = selectedSlot.substring(0, dashIndex);
        const timeString = selectedSlot.substring(dashIndex + 1);
        const currentYear = new Date().getFullYear();
        await createBooking({
          userId: TEST_USER_ID, lawyerId: lawyer.id,
          date: new Date(`${dateString} ${currentYear}`),
          timeSlot: timeString, cost: lawyer.cost,
        });
        onNavigate("booking-confirm", { lawyerId: lawyer.id, slot: selectedSlot });
      } catch (error) {
        console.error("Booking failed", error);
      } finally {
        setIsBooking(false);
      }
    }
  };

  if (!lawyer) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#C9A84C]/20 border-t-[#C9A84C] rounded-full animate-spin" />
      </div>
    );
  }

  const getInitials = (name: string) => name.split(" ").slice(1, 3).map((p) => p[0]).join("");
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "reviews", label: "Reviews" },
    { id: "availability", label: "Availability" },
  ] as const;

  return (
    <div className="min-h-screen pt-20 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Back */}
        <button
          onClick={() => onNavigate("listing")}
          className="flex items-center gap-2 text-[#dce1fb]/40 hover:text-[#dce1fb] transition-colors mb-7 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Listings
        </button>

        {/* Profile Hero Card */}
        <div className="bg-[#0c1324] rounded-2xl border border-white/[0.05] p-8 mb-6 fade-in">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl bg-[#C9A84C]/10 flex items-center justify-center text-[#C9A84C] font-bold text-2xl flex-shrink-0 font-serif">
              {getInitials(lawyer.name)}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-serif font-bold text-white mb-3">{lawyer.name}</h1>
              <div className="flex flex-wrap gap-2 mb-4">
                {lawyer.specializations.map((spec: string) => (
                  <span key={spec} className="px-2.5 py-1 bg-[#2e3447] text-[#d0c5b2] text-xs rounded-lg">
                    {spec}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm text-[#dce1fb]/50">
                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-[#C9A84C]/60" />{lawyer.city}</span>
                <span className="flex items-center gap-1.5"><Briefcase className="w-4 h-4 text-[#C9A84C]/60" />{lawyer.experience} yrs</span>
                <span className="flex items-center gap-1.5"><StarRating rating={lawyer.rating} size="sm" />{lawyer.rating}</span>
                <span className="flex items-center gap-1.5"><Languages className="w-4 h-4 text-[#C9A84C]/60" />{lawyer.languages.join(", ")}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Tabs Panel */}
          <div className="lg:col-span-2">
            <div className="bg-[#0c1324] rounded-2xl border border-white/[0.05] overflow-hidden slide-up">
              <div className="flex border-b border-white/[0.05]">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 px-5 py-4 text-sm font-medium transition-all duration-200 ${
                      activeTab === tab.id
                        ? "text-[#C9A84C] border-b-2 border-[#C9A84C] bg-[#C9A84C]/[0.03]"
                        : "text-[#dce1fb]/40 hover:text-[#dce1fb]/70"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {/* Overview */}
                {activeTab === "overview" && (
                  <div className="space-y-6 fade-in">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-[#C9A84C]/60 mb-3">About</p>
                      <p className="text-sm text-[#dce1fb]/60 leading-relaxed">{lawyer.bio}</p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {[
                        { icon: GraduationCap, label: "Education", value: lawyer.education },
                        { icon: Scale, label: "Bar Registration", value: lawyer.barRegNo || "N/A" },
                        { icon: Award, label: "Win Rate", value: lawyer.winRate ? `${lawyer.winRate}%` : "N/A" },
                        { icon: Briefcase, label: "Cases Handled", value: lawyer.casesHandled ? `${lawyer.casesHandled}+` : "N/A" },
                      ].map(({ icon: Icon, label, value }) => (
                        <div key={label} className="bg-[#151b2d] rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className="w-4 h-4 text-[#C9A84C]/60" />
                            <p className="text-[10px] uppercase tracking-widest text-[#C9A84C]/60">{label}</p>
                          </div>
                          <p className="text-sm text-white font-medium">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reviews */}
                {activeTab === "reviews" && (
                  <div className="space-y-3 fade-in">
                    {lawyerReviews.length > 0 ? (
                      lawyerReviews.map((review) => (
                        <div key={review.id} className="bg-[#151b2d] rounded-xl p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="text-sm font-semibold text-white">{review.reviewerName}</p>
                              <p className="text-xs text-[#dce1fb]/30">
                                {new Date(review.date).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
                              </p>
                            </div>
                            <StarRating rating={review.rating} size="sm" />
                          </div>
                          <p className="text-sm text-[#dce1fb]/50 leading-relaxed">{review.comment}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10">
                        <p className="text-sm text-[#dce1fb]/30">No reviews yet</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Availability */}
                {activeTab === "availability" && (
                  <div className="fade-in">
                    <p className="text-[10px] uppercase tracking-widest text-[#C9A84C]/60 mb-5">Available Slots — Next 7 Days</p>
                    <div className="space-y-5">
                      {weekSlots.map((dayData) => (
                        <div key={dayData.day}>
                          <p className="text-xs font-medium text-[#dce1fb]/40 mb-2.5 flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-[#C9A84C]/50" />
                            {dayData.day}, {dayData.date}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {dayData.slots.map((slot) => {
                              const slotId = `${dayData.date}-${slot}`;
                              const isBooked = confirmedSlots.has(slotId);
                              return (
                                <button
                                  key={slot}
                                  onClick={() => !isBooked && setSelectedSlot(slotId)}
                                  disabled={isBooked}
                                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                                    isBooked 
                                      ? "bg-[#C9A84C]/10 text-[#C9A84C]/30 cursor-not-allowed border border-[#C9A84C]/20 opacity-50"
                                      : selectedSlot === slotId
                                        ? "bg-[#C9A84C] text-[#241a00]"
                                        : "bg-[#151b2d] text-[#dce1fb]/50 hover:bg-[#1a2235] hover:text-[#dce1fb]"
                                  }`}
                                >
                                  <Clock className="w-3 h-3" />
                                  {isBooked ? "Booked" : slot}
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

          {/* Booking Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-[#0c1324] rounded-2xl border border-white/[0.05] p-6 sticky top-24 slide-up">
              <p className="text-[10px] uppercase tracking-widest text-[#C9A84C]/60 mb-1">Book a Session</p>
              <h3 className="text-lg font-serif font-bold text-white mb-5">{lawyer.name}</h3>

              {selectedSlot ? (
                <div className="bg-[#C9A84C]/[0.06] rounded-xl p-4 mb-5 border border-[#C9A84C]/20">
                  <p className="text-[10px] uppercase tracking-widest text-[#C9A84C]/60 mb-1">Selected Slot</p>
                  <p className="text-sm text-white font-medium">{selectedSlot.replace("-", " · ")}</p>
                </div>
              ) : (
                <div className="bg-[#151b2d] rounded-xl p-4 mb-5 text-center">
                  <p className="text-xs text-[#dce1fb]/30">Select a slot from the Availability tab</p>
                </div>
              )}

              <div className="space-y-2.5 mb-6 text-sm">
                <div className="flex justify-between text-[#dce1fb]/40">
                  <span>Session Fee</span>
                  <span className="text-white font-medium">₹{lawyer.cost}</span>
                </div>
                <div className="flex justify-between text-[#dce1fb]/40">
                  <span>Platform Fee</span>
                  <span className="text-white font-medium">₹0</span>
                </div>
                <div className="h-px bg-white/[0.05] my-1" />
                <div className="flex justify-between">
                  <span className="text-[#dce1fb]/60 font-medium">Total</span>
                  <span className="text-[#C9A84C] font-bold text-lg font-serif">₹{lawyer.cost}</span>
                </div>
              </div>

              <button
                onClick={handleBooking}
                disabled={!selectedSlot || isBooking}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
                  selectedSlot
                    ? "bg-[#C9A84C] hover:bg-[#e6c364] text-[#241a00] hover:-translate-y-0.5 active:translate-y-0"
                    : "bg-[#151b2d] text-[#dce1fb]/20 cursor-not-allowed"
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
