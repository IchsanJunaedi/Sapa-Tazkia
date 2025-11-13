import React, { useState, useEffect } from 'react';
import { X, Mail, MessageSquare } from 'lucide-react';

// Komponen ikon Google
const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-6 h-6 mr-3">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.343c-1.896,3.101-5.466,6.17-11.343,6.17 c-6.958,0-12.632-5.673-12.632-12.632c0-6.958,5.674-12.632,12.632-12.632c3.23,0,6.347,1.385,8.441,3.483l5.882-5.882 C34.004,5.946,29.351,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20 C44,22.659,43.834,21.32,43.611,20.083z"/>
    <path fill="#FF3D00" d="M6.309,16.713L11.822,20.3L11.822,20.3C13.298,16.59,17.207,14,21.723,14c3.41,0,6.619,1.218,8.875,3.447l0.024,0.023 l5.845-5.844C34.004,5.946,29.351,4,24,4C16.326,4,9.66,8.275,6.309,14.713z"/>
    <path fill="#4CAF50" d="M24,44c5.205,0,10.222-1.92,13.911-5.385l-6.736-6.495C30.297,33.024,27.265,34.08,24,34.08 c-5.877,0-9.448-3.07-11.344-6.171L6.309,33.287C9.66,39.725,16.326,44,24,44z"/>
    <path fill="#1976D2" d="M43.611,20.083L43.611,20.083L42,20h-0.29c-0.122-0.638-0.344-1.254-0.627-1.851 C41.347,17.385,38.23,16,35,16c-3.265,0-6.297,1.056-8.214,3.003L35.343,28h7.957 C42.834,26.68,44,25.045,44,24C44,22.659,43.834,21.32,43.611,20.083z"/>
  </svg>
);

const AuthModal = ({ isOpen, onClose, initialStep = 0, loginFunction, registerFunction }) => {
  const [step, setStep] = useState(initialStep);

  // State untuk Login dan Register
  const [loginNim, setLoginNim] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [nim, setNim] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Reset state saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setStep(initialStep);
      setLoginNim('');
      setEmail('');
      setPassword('');
      setFullName('');
      setNim('');
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen, initialStep]);

  if (!isOpen) return null;

  // Fungsi untuk guest chat
  const handleGuestChat = () => {
    window.location.href = '/chat?mode=guest';
  };

  // Fungsi handleLogin
  const handleLogin = async () => {
    if (!loginNim || !password) {
      setError('NIM and password are required.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await loginFunction(loginNim, password);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
      setIsLoading(false);
    }
  };

  // Fungsi handleSignUp
  const handleSignUp = async () => {
    if (!fullName || !nim || !email || !password) {
      setError('All fields are required.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await registerFunction({ fullName, nim, email, password });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fungsi handleGoogleLogin
  const handleGoogleLogin = () => {
    setIsLoading(true);
    console.log("Mengarahkan ke Google Login...");
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    window.location.href = `${API_URL}/api/auth/google`;
  };

  // Render content berdasarkan step
  const renderContent = () => {
    switch (step) {
      case 0: // Login
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Log Into Your Account</h2>
            <p className="text-sm text-gray-600 mb-6">Get smarter academic responses and guidance from Sapa Tazkia.</p>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-4" role="alert">
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            <input
              type="text"
              placeholder="Enter your NIM"
              value={loginNim}
              onChange={(e) => setLoginNim(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none mb-4"
              disabled={isLoading}
            />
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none mb-4"
              disabled={isLoading}
            />
            <button
              onClick={handleLogin}
              className={`w-full py-3 rounded-xl font-semibold text-white transition-colors mb-4 ${
                (loginNim && password && !isLoading) ? 'bg-gray-900 hover:bg-gray-800' : 'bg-gray-400 cursor-not-allowed'
              }`}
              disabled={!loginNim || !password || isLoading}
            >
              {isLoading ? 'Logging in...' : 'Continue'}
            </button>

            <div className="flex items-center my-4">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="flex-shrink mx-4 text-gray-500 text-sm">OR</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleGoogleLogin}
                className="w-full py-3 flex items-center justify-center border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={isLoading}
              >
                <GoogleIcon />
                Continue with google
              </button>

              {/* Tombol Guest Chat */}
              <button
                onClick={handleGuestChat}
                className="w-full py-3 flex items-center justify-center border border-blue-300 bg-blue-50 rounded-xl font-medium text-blue-600 hover:bg-blue-100 transition-colors"
                disabled={isLoading}
              >
                <MessageSquare size={20} className="mr-2" />
                Try as Guest
              </button>
            </div>

            <p className="text-sm text-center text-gray-600 mt-6">
              No account yet?
              <button onClick={() => setStep(1)} className="text-orange-500 hover:underline font-semibold ml-1 focus:outline-none" disabled={isLoading}>
                Sign Up
              </button>
            </p>
            <button onClick={onClose} className="w-full text-sm text-gray-500 hover:text-gray-900 mt-2" disabled={isLoading}>
              Close
            </button>
          </>
        );

      case 1: // Signup Step 1
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Create Your Account</h2>
            <p className="text-sm text-gray-600 mb-6">Get smarter academic responses and guidance from Sapa Tazkia.</p>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-4" role="alert">
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            <input
              type="text"
              placeholder="Full Name"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl mb-4"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isLoading}
            />
            <input
              type="text"
              placeholder="NIM"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl mb-4"
              value={nim}
              onChange={(e) => setNim(e.target.value)}
              disabled={isLoading}
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl mb-4"
              disabled={isLoading}
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl mb-4"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />

            <button
              onClick={handleSignUp}
              className={`w-full py-3 rounded-xl font-semibold text-white transition-colors mb-4 ${
                (email && password && fullName && nim && !isLoading) ? 'bg-gray-900 hover:bg-gray-800' : 'bg-gray-400 cursor-not-allowed'
              }`}
              disabled={!email || !password || !fullName || !nim || isLoading}
            >
              {isLoading ? 'Creating account...' : 'Continue'}
            </button>

            <div className="flex items-center my-4">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="flex-shrink mx-4 text-gray-500 text-sm">OR</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleGoogleLogin}
                className="w-full py-3 flex items-center justify-center border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={isLoading}
              >
                <GoogleIcon />
                Continue with google
              </button>

              {/* Tombol Guest Chat */}
              <button
                onClick={handleGuestChat}
                className="w-full py-3 flex items-center justify-center border border-blue-300 bg-blue-50 rounded-xl font-medium text-blue-600 hover:bg-blue-100 transition-colors"
                disabled={isLoading}
              >
                <MessageSquare size={20} className="mr-2" />
                Try as Guest
              </button>
            </div>

            <p className="text-sm text-center text-gray-600 mt-6">
              Already have an account?
              <button
                onClick={() => setStep(0)}
                className="text-orange-500 hover:underline font-semibold ml-1 focus:outline-none"
                disabled={isLoading}
              >
                Log in
              </button>
            </p>
            <button onClick={onClose} className="w-full text-sm text-gray-500 hover:text-gray-900 mt-2" disabled={isLoading}>
              Close
            </button>
          </>
        );

      case 2: // Signup Step 2: Verify Code
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Enter Your Code</h2>
            <p className="text-sm text-gray-600">Enter the verification code we just sent to</p>
            <p className="text-sm font-semibold text-gray-900 mb-6">{email || 'your-email@example.com'}</p>
            
            <input 
              type="text"
              placeholder="Code"
              className="w-full px-4 py-3 text-center border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none mb-4 tracking-widest text-xl font-mono"
            />

            <button
              onClick={() => onClose()}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gray-900 hover:bg-gray-800 transition-colors mb-4"
            >
              Verify Code
            </button>

            <button className="w-full text-sm text-blue-600 hover:text-blue-800 mb-6">
              Resend code
            </button>

            <p className="text-center text-xs text-gray-500 mb-10">
              <a href="#" className="hover:underline">Term of use</a> | <a href="#" className="hover:underline">Privacy policy</a>
            </p>

            <p className="text-sm text-center text-gray-600 mt-6">
              Already have an account? 
              <button onClick={() => setStep(0)} className="text-orange-500 hover:underline font-semibold ml-1">
                Log in
              </button>
            </p>
            <button onClick={onClose} className="w-full text-sm text-gray-500 hover:text-gray-900 mt-2">
              Close
            </button>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm relative transform transition-all duration-300 scale-100">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100">
          <X size={24} />
        </button>
        <div className="text-center mt-4">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;