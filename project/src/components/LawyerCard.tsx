import { MapPin, Languages } from "lucide-react";
import { Lawyer } from "../data/lawyers";
import StarRating from "./StarRating";

interface LawyerCardProps {
  lawyer: Lawyer;
  onViewProfile: (id: number) => void;
  onBookNow: (id: number) => void;
}

export default function LawyerCard({
  lawyer,
  onViewProfile,
  onBookNow,
}: LawyerCardProps) {
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

  return (
    <div className="bg-navy-50 rounded-2xl p-6 border border-gray-800 hover:border-gold/30 hover:shadow-xl hover:shadow-gold/10 transition-all duration-300 hover:-translate-y-1 slide-up">
      <div className="flex items-start gap-4 mb-4">
        <div
          className={`${colors[colorIndex]} w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}
        >
          {getInitials(lawyer.name)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-serif font-bold text-white mb-1">
            {lawyer.name}
          </h3>
          <div className="flex flex-wrap gap-2 mb-2">
            {lawyer.specializations.map((spec) => (
              <span
                key={spec}
                className="px-2 py-1 bg-gold/10 text-gold text-xs rounded-md border border-gold/20"
              >
                {spec}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-4 text-sm text-gray-300">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gold" />
          <span>
            {lawyer.city} • {lawyer.experience} yrs exp
          </span>
        </div>
        <div className="flex items-center gap-2">
          <StarRating rating={lawyer.rating} size="sm" />
          <span>
            {lawyer.rating} ({lawyer.reviews} reviews)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-gold" />
          <span>{lawyer.languages.join(", ")}</span>
        </div>
      </div>

      <div className="border-t border-gray-800 pt-4 flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-gold">₹{lawyer.cost}</div>
          <div className="text-xs text-gray-400">per session</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onViewProfile(lawyer.id)}
            className="px-4 py-2 border border-gold text-gold rounded-lg hover:bg-gold/10 transition-colors"
          >
            View Profile
          </button>
          <button
            onClick={() => onBookNow(lawyer.id)}
            className="px-4 py-2 bg-gold text-navy rounded-lg hover:bg-gold-500 transition-colors font-semibold"
          >
            Book Now
          </button>
        </div>
      </div>
    </div>
  );
}
