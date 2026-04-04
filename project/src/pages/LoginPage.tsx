import { signInWithGoogle } from '../utils/firebase';

const LoginPage = () => {
  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      // App.tsx auth state listener handle navigation
    } catch (error: any) {
      console.error(error);
      alert(`Login failed: ${error?.message || error}`);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 w-full max-w-md p-8 bg-gray-800/60 backdrop-blur-xl rounded-2xl border border-gray-700 shadow-2xl">
        <div className="text-center mb-10">
          <div className="flex justify-center items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <span className="text-2xl font-bold">N</span>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">NyayaConnect</h1>
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">Welcome Back</h2>
          <p className="text-gray-400">Sign in to access your legal dashboard</p>
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={handleLogin}
            className="group relative flex w-full items-center justify-center gap-3 rounded-xl border border-gray-600 bg-gray-800/50 px-4 py-4 text-sm font-semibold text-white transition-all hover:bg-gray-700 hover:border-gray-500 hover:shadow-lg hover:-translate-y-0.5"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            By signing in, you agree to our{' '}
            <a href="#" className="font-medium text-blue-400 hover:text-blue-300 transition-colors">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="font-medium text-blue-400 hover:text-blue-300 transition-colors">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
