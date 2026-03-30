import { useState } from 'react';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import LawyerListingPage from './pages/LawyerListingPage';
import LawyerProfilePage from './pages/LawyerProfilePage';
import BookingConfirmPage from './pages/BookingConfirmPage';
import DashboardPage from './pages/DashboardPage';

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [navData, setNavData] = useState<any>({});

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

  return (
    <div className="min-h-screen">
      <Navbar onNavigate={handleNavigate} />
      <main className="pt-16">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
