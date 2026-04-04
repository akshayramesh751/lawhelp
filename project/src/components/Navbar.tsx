import { Scale, LogOut, User as UserIcon } from "lucide-react";
import { User } from "firebase/auth";
import { logout } from "../utils/firebase";

interface NavbarProps {
  onNavigate: (page: string) => void;
  user: User | null;
}

export default function Navbar({ onNavigate, user }: NavbarProps) {
  const handleLogout = async () => {
    try {
      await logout();
      onNavigate("home");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

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

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => onNavigate("dashboard")}
                  className="flex items-center gap-2 text-gray-300 hover:text-gold transition-colors"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || "User"} className="w-8 h-8 rounded-full border border-gold/30" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                      <UserIcon className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                  <span className="hidden sm:inline font-medium">{user.displayName?.split(' ')[0]}</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => onNavigate("dashboard")} // This will trigger login in App.tsx
                className="bg-gold hover:bg-gold-500 text-navy px-6 py-2 rounded-lg font-semibold transition-all hover:shadow-lg hover:shadow-gold/20"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
