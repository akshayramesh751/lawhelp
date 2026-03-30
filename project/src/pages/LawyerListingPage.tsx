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
          <aside
            className={`${showFilters ? "block" : "hidden"} lg:block w-full lg:w-80 flex-shrink-0`}
          >
            <div className="bg-navy-50 rounded-2xl p-6 border border-gray-800 sticky top-24">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-serif font-bold text-gold flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5" />
                  Filters
                </h2>
                <button
                  onClick={() =>
                    setShowFilters(!showFilters)
                  }
                  className="lg:hidden text-gray-400 hover:text-gold"
                >
                  Close
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    Price Range
                  </label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="5000"
                      step="100"
                      value={priceRange[1]}
                      onChange={(e) =>
                        setPriceRange([priceRange[0], parseInt(e.target.value)])
                      }
                      className="w-full accent-gold"
                    />
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>₹{priceRange[0]}</span>
                      <span>₹{priceRange[1]}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    City
                  </label>
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-navy border border-gray-700 text-gray-200 focus:outline-none focus:border-gold"
                  >
                    {cities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    Minimum Rating
                  </label>
                  <div className="flex gap-2">
                    {[0, 3, 4, 4.5].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => setMinRating(rating)}
                        className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                          minRating === rating
                            ? "bg-gold text-navy font-semibold"
                            : "bg-navy border border-gray-700 text-gray-300 hover:border-gold"
                        }`}
                      >
                        {rating === 0 ? "All" : `${rating}★+`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    Specialization
                  </label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {allSpecializations.map((spec) => (
                      <label
                        key={spec}
                        className="flex items-center gap-2 cursor-pointer group"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSpecializations.includes(spec)}
                          onChange={() => toggleSpecialization(spec)}
                          className="w-4 h-4 rounded accent-gold"
                        />
                        <span className="text-sm text-gray-300 group-hover:text-gold transition-colors">
                          {spec}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setPriceRange([0, 5000]);
                    setSelectedCity("All");
                    setMinRating(0);
                    setSelectedSpecializations([]);
                  }}
                  className="w-full px-4 py-2 border border-gold text-gold rounded-lg hover:bg-gold/10 transition-colors"
                >
                  Clear All Filters
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
