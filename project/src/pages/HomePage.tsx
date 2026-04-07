import { useState } from "react";
import { ArrowRight, MessageSquare, UserCheck, Calendar, Star, Scale } from "lucide-react";

interface HomePageProps {
  onNavigate: (page: string, data?: { searchQuery?: string }) => void;
}

export default function HomePage({ onNavigate }: HomePageProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = () => {
    if (searchQuery.trim()) {
      onNavigate("listing", { searchQuery });
    }
  };

  const steps = [
    { number: 1, icon: MessageSquare, title: "Describe Issue", description: "Tell us about your legal problem in simple words" },
    { number: 2, icon: UserCheck, title: "Get Matched", description: "Our system finds the right lawyers for your case" },
    { number: 3, icon: Calendar, title: "Book Session", description: "Choose a time slot and confirm your booking" },
    { number: 4, icon: Star, title: "Rate & Review", description: "Share your experience to help others" },
  ];

  const stats = [
    { value: "500+", label: "Verified Lawyers" },
    { value: "₹499", label: "Avg Session Cost" },
    { value: "4.7★", label: "Average Rating" },
    { value: "20+", label: "Cities Covered" },
  ];

  return (
    <div className="min-h-screen pt-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Subtle ambient gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(201,168,76,0.06)_0%,_transparent_60%)] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-36">
          {/* Eyebrow label */}
          <div className="flex justify-center mb-6 fade-in">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/20 text-[#C9A84C] text-xs font-medium tracking-widest uppercase">
              <Scale className="w-3 h-3" />
              India's Legal Marketplace
            </span>
          </div>

          {/* Headline */}
          <div className="text-center mb-10 fade-in">
            <h1 className="text-5xl lg:text-7xl font-serif font-bold text-white mb-5 leading-tight tracking-tight">
              Your Legal Problem,{" "}
              <span className="text-[#C9A84C]">Solved.</span>
            </h1>
            <p className="text-lg text-[#dce1fb]/60 max-w-2xl mx-auto leading-relaxed">
              Describe your issue, get matched with verified lawyers, and book a consultation in minutes.
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-3xl mx-auto slide-up">
            <div className="bg-[#151b2d] rounded-2xl p-2 border border-white/[0.07]">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="e.g. My employer hasn't paid my salary for 2 months..."
                  className="flex-1 px-5 py-4 bg-transparent text-[#dce1fb] placeholder-[#dce1fb]/30 focus:outline-none text-sm"
                />
                <button
                  onClick={handleSearch}
                  className="bg-[#C9A84C] hover:bg-[#e6c364] text-[#241a00] px-7 py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap"
                >
                  Find Lawyers
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 max-w-3xl mx-auto mt-16 pt-10 border-t border-white/[0.06]">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className="text-center py-4 fade-in"
                style={{ animationDelay: `${i * 0.07}s` }}
              >
                <div className="text-3xl font-serif font-bold text-[#C9A84C] mb-1">{stat.value}</div>
                <div className="text-xs text-[#dce1fb]/40 tracking-wide">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-[#0c1324]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#C9A84C]/60 mb-3">How It Works</p>
            <h2 className="text-4xl lg:text-5xl font-serif font-bold text-white mb-3">
              Simple. Fast. Reliable.
            </h2>
            <p className="text-[#dce1fb]/40 text-sm max-w-md mx-auto">
              Get expert legal counsel in 4 straightforward steps
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className="relative bg-[#151b2d] rounded-2xl p-7 hover:bg-[#1a2235] transition-all duration-300 hover:-translate-y-1 slide-up group"
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                {/* Step number */}
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#C9A84C]/10 text-[#C9A84C] text-xs font-bold mb-5">
                  {step.number}
                </span>
                <step.icon className="w-8 h-8 text-[#C9A84C]/70 mb-4 group-hover:text-[#C9A84C] transition-colors duration-300" />
                <h3 className="text-base font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-[#dce1fb]/40 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
