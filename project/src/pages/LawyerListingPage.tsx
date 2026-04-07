import { useState, useEffect } from "react";
import { Tag, SlidersHorizontal } from "lucide-react";
import { getLawyers } from "../api/lawyers";
import { classifyIssue } from "../utils/classification";
import LawyerCard from "../components/LawyerCard";

export interface Lawyer {
  id?: string | number;
  _id?: string;
  name: string;
  specializations: string[];
  city: string;
  experience: number;
  rating: number;
  reviews?: number;
  totalReviews?: number;
  cost: number;
  languages: string[];
  bio: string;
  education: string;
  barReg?: string;
  winRate?: number;
  casesHandled?: number;
}

interface LawyerListingPageProps {
  searchQuery?: string;
  onNavigate: (page: string, data?: { lawyerId?: number }) => void;
}

export default function LawyerListingPage({
  searchQuery = "",
  onNavigate,
}: LawyerListingPageProps) {
  const [detectedCategory, setDetectedCategory] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState([0, 5000]);
  const [selectedCity, setSelectedCity] = useState("All");
  const [minRating, setMinRating] = useState(0);
  const [selectedSpecializations, setSelectedSpecializations] = useState<
    string[]
  >([]);
  const [filteredLawyers, setFilteredLawyers] = useState<Lawyer[]>([]);
  const [showFilters, setShowFilters] = useState(true);

  const cities = ["All", "Delhi", "Mumbai", "Bangalore", "Chennai", "Hyderabad", "Pune", "Kolkata"];
  const allSpecializations = [
    "Labour Law",
    "Family Law",
    "Property Law",
    "Criminal Law",
    "Consumer Law",
    "Employment",
    "Divorce",
    "Real Estate",
    "Service Law",
    "Financial Fraud",
  ];

  useEffect(() => {
    if (searchQuery) {
      const category = classifyIssue(searchQuery);
      setDetectedCategory(category);
      if (category) {
        setSelectedSpecializations([category]);
      }
    }
  }, [searchQuery]);

  useEffect(() => {
    const fetchLawyers = async () => {
      try {
        const filters: any = {};
        if (selectedCity !== "All") filters.city = selectedCity;
        if (minRating > 0) filters.minRating = minRating;
        if (priceRange[1] < 5000) filters.maxCost = priceRange[1];
        if (selectedSpecializations.length > 0) filters.specialization = selectedSpecializations[0];

        const data = await getLawyers(filters);
        const formattedData = data.map((l: any) => ({ ...l, id: l._id, reviews: l.totalReviews }));
        const matched = formattedData.filter((lawyer: Lawyer) => lawyer.cost >= priceRange[0]);
        setFilteredLawyers(matched);
      } catch (error) {
        console.error("Failed to fetch lawyers", error);
      }
    };

    fetchLawyers();
  }, [priceRange, selectedCity, minRating, selectedSpecializations]);

  const toggleSpecialization = (spec: string) => {
    setSelectedSpecializations((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]
    );
  };

  return (
    <div className="min-h-screen pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {detectedCategory && (
          <div className="mb-6 bg-gold/10 border border-gold/30 rounded-xl p-4 flex items-center gap-3 fade-in">
            <Tag className="w-5 h-5 text-gold" />
            <span className="text-gray-200">
              Case Type Detected:{" "}
              <span className="font-bold text-gold">{detectedCategory}</span>
            </span>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filter Sidebar */}
          <aside className={`${showFilters ? "block" : "hidden"} lg:block w-full lg:w-72 flex-shrink-0`}>
            <div className="bg-[#151b2d] rounded-2xl p-6 sticky top-24">

              {/* Header */}
              <div className="flex items-center justify-between mb-7">
                <div className="flex items-center gap-2.5">
                  <SlidersHorizontal className="w-4 h-4 text-[#C9A84C]" />
                  <h2 className="font-serif text-white text-base font-semibold tracking-wide">Refine Search</h2>
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden text-xs text-[#C9A84C]/60 hover:text-[#C9A84C] transition-colors"
                >
                  Close
                </button>
              </div>

              <div className="space-y-7">
                {/* Price Range */}
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#C9A84C]/60 font-medium mb-3">Price Range</p>
                  <input
                    type="range"
                    min="0"
                    max="5000"
                    step="100"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                    className="w-full accent-[#C9A84C] h-1 rounded-full bg-[#2e3447] appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between mt-2">
                    <span className="text-xs text-[#dce1fb]/50 bg-[#070d1f] px-2 py-0.5 rounded-md">₹{priceRange[0]}</span>
                    <span className="text-xs text-[#C9A84C] bg-[#070d1f] px-2 py-0.5 rounded-md font-medium">up to ₹{priceRange[1]}</span>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/[0.06]"></div>

                {/* City */}
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#C9A84C]/60 font-medium mb-3">Location</p>
                  <div className="relative">
                    <select
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#070d1f] text-[#dce1fb] text-sm rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#C9A84C]/40 transition-colors appearance-none cursor-pointer"
                    >
                      {cities.map((city) => (
                        <option key={city} value={city} className="bg-[#0c1324]">{city}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#C9A84C]/50">▾</div>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/[0.06]"></div>

                {/* Rating */}
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#C9A84C]/60 font-medium mb-3">Minimum Rating</p>
                  <div className="flex flex-wrap gap-2">
                    {[0, 3, 4, 4.5].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => setMinRating(rating)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                          minRating === rating
                            ? "bg-[#C9A84C] text-[#241a00]"
                            : "bg-[#070d1f] text-[#dce1fb]/60 hover:text-[#dce1fb] border border-white/[0.08]"
                        }`}
                      >
                        {rating === 0 ? "All" : `${rating}★+`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/[0.06]"></div>

                {/* Specializations */}
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#C9A84C]/60 font-medium mb-3">Practice Area</p>
                  <div className="flex flex-wrap gap-2">
                    {allSpecializations.map((spec) => (
                      <button
                        key={spec}
                        onClick={() => toggleSpecialization(spec)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                          selectedSpecializations.includes(spec)
                            ? "bg-[#C9A84C] text-[#241a00]"
                            : "bg-[#2e3447] text-[#d0c5b2] hover:bg-[#33394c]"
                        }`}
                      >
                        {spec}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/[0.06]"></div>

                {/* Clear */}
                <button
                  onClick={() => {
                    setPriceRange([0, 5000]);
                    setSelectedCity("All");
                    setMinRating(0);
                    setSelectedSpecializations([]);
                  }}
                  className="text-xs text-[#C9A84C]/50 hover:text-[#C9A84C] transition-colors underline underline-offset-2 decoration-dotted"
                >
                  Clear all filters
                </button>
              </div>
            </div>
          </aside>

          <div className="flex-1">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-serif font-bold text-white">
                {filteredLawyers.length} Lawyers Found
              </h1>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="lg:hidden px-4 py-2 bg-gold text-navy rounded-lg font-semibold"
              >
                Filters
              </button>
            </div>

            {filteredLawyers.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-400 text-lg mb-4">
                  No lawyers found matching your criteria
                </p>
                <button
                  onClick={() => {
                    setPriceRange([0, 5000]);
                    setSelectedCity("All");
                    setMinRating(0);
                    setSelectedSpecializations([]);
                  }}
                  className="px-6 py-3 bg-gold text-navy rounded-lg font-semibold hover:bg-gold-500 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {filteredLawyers.map((lawyer) => (
                  <LawyerCard
                    key={lawyer.id}
                    lawyer={lawyer as any}
                    onViewProfile={(id) => onNavigate("profile", { lawyerId: id })}
                    onBookNow={(id) => onNavigate("profile", { lawyerId: id })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
