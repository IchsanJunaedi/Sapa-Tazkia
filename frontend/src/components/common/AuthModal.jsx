import React, { useState } from 'react';
import { X, Mail, ChevronRight, User, Key } from 'lucide-react';

// Sub-componente untuk berbagai tampilan modal
// Komponen Email dan Password akan diimpor (diasumsikan sudah ada)

// Komponen ikon Google yang sangat sederhana
const GoogleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-6 h-6 mr-3">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.343c-1.896,3.101-5.466,6.17-11.343,6.17 c-6.958,0-12.632-5.673-12.632-12.632c0-6.958,5.674-12.632,12.632-12.632c3.23,0,6.347,1.385,8.441,3.483l5.882-5.882 C34.004,5.946,29.351,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20 C44,22.659,43.834,21.32,43.611,20.083z"/>
        <path fill="#FF3D00" d="M6.309,16.713L11.822,20.3L11.822,20.3C13.298,16.59,17.207,14,21.723,14c3.41,0,6.619,1.218,8.875,3.447l0.024,0.023 l5.845-5.844C34.004,5.946,29.351,4,24,4C16.326,4,9.66,8.275,6.309,14.713z"/>
        <path fill="#4CAF50" d="M24,44c5.205,0,10.222-1.92,13.911-5.385l-6.736-6.495C30.297,33.024,27.265,34.08,24,34.08 c-5.877,0-9.448-3.07-11.344-6.171L6.309,33.287C9.66,39.725,16.326,44,24,44z"/>
        <path fill="#1976D2" d="M43.611,20.083L43.611,20.083L42,20h-0.29c-0.122-0.638-0.344-1.254-0.627-1.851 C41.347,17.385,38.23,16,35,16c-3.265,0-6.297,1.056-8.214,3.003L35.343,28h7.957 C42.834,26.68,44,25.045,44,24C44,22.659,43.834,21.32,43.611,20.083z"/>
    </svg>
);


const AuthModal = ({ isOpen, onClose }) => {
  // 0: Login (image_ec8b50)
  // 1: Signup Step 1 (image_ec8dff)
  // 2: Signup Step 2 - Verify Code (image_ec8e1f)
  const [step, setStep] = useState(0); 
  const [email, setEmail] = useState('');

  if (!isOpen) return null;

  // Render berdasarkan langkah (step)
  const renderContent = () => {
    switch (step) {
      case 0: // Login: Log Into Your Account
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Log Into Your Account</h2>
            <p className="text-sm text-gray-600 mb-6">Get smarter academic responses and guidance from Sapa Tazkia.</p>
            
            {/* Input Email */}
            <input 
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none mb-4"
            />

            {/* Tombol Continue (Hitam) */}
            <button
              onClick={() => {
                if (email) setStep(1); // Lanjut ke Signup Step 1 setelah email diisi
              }}
              className={`w-full py-3 rounded-xl font-semibold text-white transition-colors mb-4 ${
                email ? 'bg-gray-900 hover:bg-gray-800' : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              Continue
            </button>

            {/* OR Divider */}
            <div className="flex items-center my-4">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="flex-shrink mx-4 text-gray-500 text-sm">OR</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>

            {/* Opsi Login */}
            <div className="space-y-3">
              <button className="w-full py-3 flex items-center justify-center border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <GoogleIcon />
                Continue with google
              </button>
              <button className="w-full py-3 flex items-center justify-center border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <Mail size={20} className="mr-3 text-gray-500" />
                Email and password
              </button>
            </div>

            {/* Footer */}
            <p className="text-sm text-center text-gray-600 mt-6">
              No account yet? <a href="#" onClick={() => setStep(1)} className="text-orange-500 hover:underline font-semibold">Sign Up</a>
            </p>
            <button onClick={onClose} className="w-full text-sm text-gray-500 hover:text-gray-900 mt-2">
              Close
            </button>
          </>
        );

      case 1: // Signup Step 1: Create Your Account
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Create Your Account</h2>
            <p className="text-sm text-gray-600 mb-6">Get smarter academic responses and guidance from Sapa Tazkia.</p>
            
            {/* Display Email (Simulasi tampilan input terisi) */}
            <div className="w-full px-4 py-3 flex items-center justify-between bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-medium mb-4">
              <span>{email || 'ican234@gmail.com'}</span>
              <Mail size={16} />
            </div>

            {/* Tombol Continue (Hitam) */}
            <button
              onClick={() => setStep(2)} // Lanjut ke Verifikasi Kode
              className="w-full py-3 rounded-xl font-semibold text-white bg-gray-900 hover:bg-gray-800 transition-colors mb-4"
            >
              Continue
            </button>

            {/* OR Divider */}
            <div className="flex items-center my-4">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="flex-shrink mx-4 text-gray-500 text-sm">OR</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>

            {/* Opsi Login */}
            <div className="space-y-3">
              <button className="w-full py-3 flex items-center justify-center border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <GoogleIcon />
                Continue with google
              </button>
              <button className="w-full py-3 flex items-center justify-center border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <Mail size={20} className="mr-3 text-gray-500" />
                Email and password
              </button>
            </div>

            {/* Footer */}
            <p className="text-sm text-center text-gray-600 mt-6">
              Already have an account? <a href="#" onClick={() => setStep(0)} className="text-orange-500 hover:underline font-semibold">Log in</a>
            </p>
            <button onClick={onClose} className="w-full text-sm text-gray-500 hover:text-gray-900 mt-2">
              Close
            </button>
          </>
        );

      case 2: // Signup Step 2: Enter Your Code
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Enter Your Code</h2>
            <p className="text-sm text-gray-600">Enter the verification code we just sent to</p>
            <p className="text-sm font-semibold text-gray-900 mb-6">{email || 'ican234@gmail.com'}</p>
            
            {/* Input Code */}
            <input 
              type="text"
              placeholder="Code"
              className="w-full px-4 py-3 text-center border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none mb-4 tracking-widest text-xl font-mono"
            />

            {/* Tombol Verify Code (Hitam) */}
            <button
              onClick={() => onClose()} // Asumsi verifikasi sukses, tutup modal
              className="w-full py-3 rounded-xl font-semibold text-white bg-gray-900 hover:bg-gray-800 transition-colors mb-4"
            >
              Verify Code
            </button>

            {/* Resend Code Link */}
            <button className="w-full text-sm text-blue-600 hover:text-blue-800 mb-6">
              Resend code
            </button>

            {/* Terms & Privacy Link */}
            <p className="text-center text-xs text-gray-500 mb-10">
              <a href="#" className="hover:underline">Term of use</a> | <a href="#" className="hover:underline">Privacy policy</a>
            </p>

            {/* Footer */}
            <p className="text-sm text-center text-gray-600 mt-6">
              Already have an account? <a href="#" onClick={() => setStep(0)} className="text-orange-500 hover:underline font-semibold">Log in</a>
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
    // Backdrop
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      {/* Modal Card */}
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm relative transform transition-all duration-300 scale-100">
        
        {/* Tombol Tutup */}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100">
          <X size={24} />
        </button>

        {/* Konten Utama */}
        <div className="text-center mt-4">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
