import { useState } from "react";
import { ArrowRight, MessageSquare, UserCheck, Calendar, Star } from "lucide-react";

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
    {
      number: 1,
      icon: MessageSquare,
      title: "Describe Issue",
      description: "Tell us about your legal problem in simple words",
    },
    {
      number: 2,
      icon: UserCheck,
      title: "Get Matched",
      description: "Our system finds the right lawyers for your case",
    },
    {
      number: 3,
      icon: Calendar,
      title: "Book Session",
      description: "Choose a time slot and confirm your booking",
    },
    {
      number: 4,
      icon: Star,
      title: "Rate & Review",
      description: "Share your experience to help others",
    },
  ];

  return (
    <div className="min-h-screen pt-16">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gold/5 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="text-center mb-12 fade-in">
            <h1 className="text-5xl lg:text-7xl font-serif font-bold text-white mb-6">
              Your Legal Problem,{" "}
              <span className="text-gold">Solved.</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-12">
              Describe your issue, get matched with verified lawyers, book a
              session in minutes.
            </p>

            <div className="max-w-3xl mx-auto slide-up">
              <div className="bg-white rounded-2xl p-2 shadow-2xl shadow-gold/10">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="e.g. My employer hasn't paid salary for 2 months..."
                    className="flex-1 px-6 py-4 rounded-xl text-navy-200 placeholder-gray-500 focus:outline-none text-lg"
                  />
                  <button
                    onClick={handleSearch}
                    className="bg-gold hover:bg-gold-500 text-navy px-8 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-gold/30"
                  >
                    Find Lawyers
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto text-center pt-12 border-t border-gray-800">
            <div className="fade-in">
              <div className="text-3xl font-bold text-gold mb-1">500+</div>
              <div className="text-sm text-gray-400">Verified Lawyers</div>
            </div>
            <div className="fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="text-3xl font-bold text-gold mb-1">₹499</div>
              <div className="text-sm text-gray-400">Avg Session Cost</div>
            </div>
            <div className="fade-in" style={{ animationDelay: "0.2s" }}>
              <div className="text-3xl font-bold text-gold mb-1">4.7★</div>
              <div className="text-sm text-gray-400">Average Rating</div>
            </div>
            <div className="fade-in" style={{ animationDelay: "0.3s" }}>
              <div className="text-3xl font-bold text-gold mb-1">20+</div>
              <div className="text-sm text-gray-400">Cities Covered</div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-navy-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-serif font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-gray-400 text-lg">
              Get legal help in 4 simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className="relative slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="bg-navy rounded-2xl p-8 border border-gray-800 hover:border-gold/30 transition-all hover:shadow-lg hover:shadow-gold/10">
                  <div className="absolute -top-4 -left-4 w-12 h-12 bg-gold rounded-full flex items-center justify-center font-bold text-navy text-xl shadow-lg">
                    {step.number}
                  </div>
                  <step.icon className="w-12 h-12 text-gold mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-gray-400">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
