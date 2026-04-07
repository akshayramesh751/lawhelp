import { useState, useEffect, Suspense, lazy } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './utils/firebase';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';

// Lazy loading to ensure speed and prevent lagging
const HomePage = lazy(() => import('./pages/HomePage'));
const LawyerListingPage = lazy(() => import('./pages/LawyerListingPage'));
const LawyerProfilePage = lazy(() => import('./pages/LawyerProfilePage'));
const BookingConfirmPage = lazy(() => import('./pages/BookingConfirmPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));

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
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#020617] via-[#0B1120] to-[#0f1b3b] animate-gradient-xy">
      <Navbar onNavigate={handleNavigate} user={user} />
      <main className="pt-2">
        <Suspense fallback={
          <div className="flex h-[80vh] items-center justify-center">
            <div className="w-12 h-12 border-4 border-gold/30 border-t-gold rounded-full animate-spin"></div>
          </div>
        }>
          {renderPage()}
        </Suspense>
      </main>
    </div>
  );
}

export default App;
