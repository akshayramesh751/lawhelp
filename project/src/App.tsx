import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './utils/firebase';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import LawyerListingPage from './pages/LawyerListingPage';
import LawyerProfilePage from './pages/LawyerProfilePage';
import BookingConfirmPage from './pages/BookingConfirmPage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('home');
  const [navData, setNavData] = useState<any>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleNavigate = (page: string, data?: any) => {
    setCurrentPage(page);
    if (data) {
      setNavData(data);
    } else {
      setNavData({});
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onNavigate={handleNavigate} />;
      case 'listing':
        return <LawyerListingPage onNavigate={handleNavigate} searchQuery={navData?.searchQuery} />;
      case 'profile':
        return <LawyerProfilePage onNavigate={handleNavigate} lawyerId={navData?.lawyerId || 1} />;
      case 'booking-confirm':
        return <BookingConfirmPage onNavigate={handleNavigate} lawyerId={navData?.lawyerId || 1} slot={navData?.slot || ''} />;
      case 'dashboard':
        return <DashboardPage onNavigate={handleNavigate} />;
      default:
        return <HomePage onNavigate={handleNavigate} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen">
      <Navbar onNavigate={handleNavigate} user={user} />
      <main className="pt-16">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
