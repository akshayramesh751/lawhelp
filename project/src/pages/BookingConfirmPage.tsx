import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Phone } from "lucide-react";
import { getLawyerById } from "../api/lawyers";

interface BookingConfirmPageProps {
  lawyerId: number;
  slot: string;
  onNavigate: (page: string) => void;
}

export default function BookingConfirmPage({
  lawyerId,
  slot,
  onNavigate,
}: BookingConfirmPageProps) {
  const [lawyer, setLawyer] = useState<any>(null);

  useEffect(() => {
    const fetchLawyer = async () => {
      try {
        const data = await getLawyerById(lawyerId);
        setLawyer(data.lawyer);
      } catch (e) {
        console.error("Failed to fetch lawyer for confirmation screen", e);
      }
    };
    fetchLawyer();
  }, [lawyerId]);

  if (!lawyer) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <p className="text-gray-400">Loading booking information...</p>
      </div>
    );
  }

  const dashIndex = slot?.indexOf("-") || 0;
  const date = slot?.substring(0, dashIndex);
  const time = slot?.substring(dashIndex + 1);

  return (
    <div className="min-h-screen pt-16 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full fade-in">
        <div className="bg-navy-50 rounded-2xl border border-gold/30 p-8 text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gold/10 rounded-full mb-6">
            <CheckCircle2 className="w-12 h-12 text-gold" />
          </div>

          <h1 className="text-3xl font-serif font-bold text-white mb-3">
            Booking Requested!
          </h1>
          <p className="text-gray-400 mb-8">
            Your consultation request has been sent to the lawyer
          </p>

          <div className="bg-navy rounded-xl p-6 border border-gray-800 text-left space-y-4 mb-8">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-400 mb-1">Lawyer</p>
                <p className="text-white font-semibold text-lg">{lawyer.name}</p>
              </div>
              <span className="px-3 py-1 bg-yellow-500/10 text-yellow-500 text-sm rounded-lg border border-yellow-500/20 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Pending Approval
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
              <div>
                <p className="text-sm text-gray-400 mb-1">Date</p>
                <p className="text-white font-semibold">{date}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Time</p>
                <p className="text-white font-semibold">{time}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-800">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Session Cost</span>
                <span className="text-gold font-bold text-2xl">₹{lawyer.cost}</span>
              </div>
            </div>
          </div>

          <div className="bg-gold/10 border border-gold/20 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-gold flex-shrink-0 mt-1" />
              <div className="text-left">
                <p className="text-white font-semibold mb-1">WhatsApp Notification</p>
                <p className="text-sm text-gray-300">
                  The lawyer will be notified via WhatsApp. You'll receive confirmation shortly.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => onNavigate("dashboard")}
              className="flex-1 bg-gold hover:bg-gold-500 text-navy px-6 py-3 rounded-lg font-bold transition-all hover:shadow-lg hover:shadow-gold/20"
            >
              View My Bookings
            </button>
            <button
              onClick={() => onNavigate("home")}
              className="flex-1 border border-gold text-gold px-6 py-3 rounded-lg font-bold hover:bg-gold/10 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>

        <div className="text-center text-gray-400 text-sm">
          <p>Booking ID: BK{Date.now().toString().slice(-6)}</p>
        </div>
      </div>
    </div>
  );
}
