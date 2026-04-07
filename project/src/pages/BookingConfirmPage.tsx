import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Mail, ArrowRight } from "lucide-react";
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
        <div className="w-8 h-8 border-4 border-[#C9A84C]/20 border-t-[#C9A84C] rounded-full animate-spin" />
      </div>
    );
  }

  const dashIndex = slot?.indexOf("-") || 0;
  const date = slot?.substring(0, dashIndex);
  const time = slot?.substring(dashIndex + 1);
  const BookingId = `BK${Date.now().toString().slice(-6)}`;

  return (
    <div className="min-h-screen pt-16 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full fade-in">

        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#C9A84C]/10 rounded-2xl mb-5">
            <CheckCircle2 className="w-9 h-9 text-[#C9A84C]" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-white mb-2">
            Booking Requested
          </h1>
          <p className="text-sm text-[#dce1fb]/40">
            Your consultation request has been sent to the lawyer
          </p>
        </div>

        {/* Booking Details Card */}
        <div className="bg-[#0c1324] rounded-2xl border border-white/[0.06] overflow-hidden mb-4">

          {/* Card Header */}
          <div className="px-6 py-5 border-b border-white/[0.04]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#C9A84C]/60 mb-1">Lawyer</p>
                <p className="text-white font-semibold">{lawyer.name}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-400 text-xs font-medium rounded-full border border-amber-500/20">
                <Clock className="w-3 h-3" />
                Pending Approval
              </span>
            </div>
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-2 divide-x divide-white/[0.04]">
            <div className="px-6 py-5">
              <p className="text-[10px] uppercase tracking-widest text-[#C9A84C]/60 mb-1">Date</p>
              <p className="text-white font-semibold text-sm">{date}</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-[10px] uppercase tracking-widest text-[#C9A84C]/60 mb-1">Time Slot</p>
              <p className="text-white font-semibold text-sm">{time}</p>
            </div>
          </div>

          {/* Cost Row */}
          <div className="px-6 py-5 border-t border-white/[0.04] flex items-center justify-between">
            <span className="text-sm text-[#dce1fb]/40">Session Fee</span>
            <span className="text-[#C9A84C] font-bold text-xl font-serif">₹{lawyer.cost}</span>
          </div>
        </div>

        {/* Email Notification Banner */}
        <div className="flex items-start gap-3 bg-[#151b2d] rounded-xl px-5 py-4 mb-6 border border-white/[0.04]">
          <Mail className="w-4 h-4 text-[#C9A84C]/70 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-white font-medium mb-0.5">Email Notification Sent</p>
            <p className="text-xs text-[#dce1fb]/40 leading-relaxed">
              The lawyer has been notified via email. You'll receive a confirmation once they respond.
            </p>
          </div>
        </div>

        {/* Booking ID */}
        <p className="text-center text-[10px] uppercase tracking-widest text-[#dce1fb]/25 mb-6">
          Booking Ref: {BookingId}
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => onNavigate("dashboard")}
            className="flex-1 bg-[#C9A84C] hover:bg-[#e6c364] text-[#241a00] px-6 py-3 rounded-xl font-bold text-sm transition-all duration-200 hover:-translate-y-0.5 flex items-center justify-center gap-2"
          >
            View My Bookings
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate("home")}
            className="flex-1 bg-[#151b2d] hover:bg-[#1a2235] text-[#dce1fb]/70 hover:text-[#dce1fb] px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
