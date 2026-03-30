import { Scale } from "lucide-react";

interface NavbarProps {
  onNavigate: (page: string) => void;
}

export default function Navbar({ onNavigate }: NavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-navy-100 border-b border-gray-800 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button
            onClick={() => onNavigate("home")}
            className="flex items-center gap-2 text-gold hover:text-gold-300 transition-colors"
          >
            <Scale className="w-6 h-6" />
            <span className="font-serif text-xl font-bold">NyayaConnect</span>
          </button>

          <div className="hidden md:flex items-center gap-8">
            <button
              onClick={() => onNavigate("listing")}
              className="text-gray-300 hover:text-gold transition-colors"
            >
              Find a Lawyer
            </button>
            <button
              onClick={() => onNavigate("home")}
              className="text-gray-300 hover:text-gold transition-colors"
            >
              How It Works
            </button>
            <button className="text-gray-300 hover:text-gold transition-colors">
              For Lawyers
            </button>
          </div>

          <button
            onClick={() => onNavigate("dashboard")}
            className="bg-gold hover:bg-gold-500 text-navy px-6 py-2 rounded-lg font-semibold transition-all hover:shadow-lg hover:shadow-gold/20"
          >
            My Account
          </button>
        </div>
      </div>
    </nav>
  );
}
