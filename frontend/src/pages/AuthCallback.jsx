import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, isAuthenticated, loading, user } = useAuth();
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('Processing authentication...');

  // ✅ SOLUSI RADIKAL: Gunakan useRef untuk track processed state
  const hasProcessedRef = useRef(false);
  const processingRef = useRef(false);

  useEffect(() => {
    // ✅ PERBAIKAN 1: Skip jika masih loading atau sedang processing
    if (loading || processingRef.current) {
      console.log('🔍 [AUTH CALLBACK] Auth context loading or already processing, skipping...');
      return;
    }

    // ✅ PERBAIKAN 2: Skip jika sudah diproses (gunakan ref untuk menghindari re-render)
    if (hasProcessedRef.current) {
      console.log('🔍 [AUTH CALLBACK] Already processed (ref), skipping');
      return;
    }

    // ✅ PERBAIKAN 3: Jika sudah authenticated, langsung redirect ke path yang benar
    if (isAuthenticated) {
      console.log('🔍 [AUTH CALLBACK] Already authenticated, redirecting...', user);
      if (user && user.userType === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/chat', { replace: true });
      }
      return;
    }

    const handleAuthCallback = async () => {
      // ✅ Tandai sedang processing untuk cegah multiple execution
      processingRef.current = true;

      try {
        setStatus('Validating authentication data...');

        // Ambil semua parameter dari URL
        const token = searchParams.get('token');
        const userParam = searchParams.get('user');
        const success = searchParams.get('success');
        const requiresVerification = searchParams.get('requires_verification') === 'true';

        console.log('🔍 [AUTH CALLBACK] URL Parameters:', {
          token: token ? `✓ Available (${token.length} chars)` : '✗ Missing',
          userParam: userParam ? '✓ Available' : '✗ Missing',
          success,
          requiresVerification,
          fullURL: window.location.href
        });

        // Validasi parameter
        if (success !== 'true') {
          console.error('❌ [AUTH CALLBACK] OAuth failed - success parameter is not true');
          setError('Authentication failed. Please try again.');
          setStatus('Authentication failed');
          setTimeout(() => {
            navigate('/', {
              state: { error: 'Authentication failed. Please try again.' },
              replace: true
            });
          }, 2000);
          return;
        }

        if (!token || !userParam) {
          console.error('❌ [AUTH CALLBACK] Missing token or user data');
          setError('Missing authentication data.');
          setStatus('Missing authentication data');
          setTimeout(() => {
            navigate('/', {
              state: { error: 'Missing authentication data.' },
              replace: true
            });
          }, 2000);
          return;
        }

        try {
          setStatus('Parsing user data...');

          // Parse user data
          const userData = JSON.parse(decodeURIComponent(userParam));

          console.log('✅ [AUTH CALLBACK] Parsed user data:', {
            id: userData.id,
            fullName: userData.fullName,
            email: userData.email,
            isProfileComplete: userData.isProfileComplete,
            isEmailVerified: userData.isEmailVerified,
            authMethod: userData.authMethod,
            nim: userData.nim
          });

          // ✅ ✅ ✅ PERBAIKAN KRITIS: Cek apakah perlu verifikasi email
          const needsEmailVerification = requiresVerification ||
            (userData && !userData.isEmailVerified);

          console.log('🔍 [AUTH CALLBACK] Verification check:', {
            needsEmailVerification,
            fromParams: requiresVerification,
            fromUserData: userData?.isEmailVerified,
            authMethod: userData?.authMethod
          });

          // ✅ PERBAIKAN: Prioritaskan verifikasi email untuk new user
          if (needsEmailVerification) {
            console.log('🔐 [AUTH CALLBACK] Email verification required - Redirecting to VERIFICATION PAGE');

            // Simpan data sementara untuk verifikasi
            localStorage.setItem('pendingVerificationEmail', userData.email);
            localStorage.setItem('verificationUserData', JSON.stringify(userData));
            localStorage.setItem('verificationToken', token);

            // ✅ PERBAIKAN: Clear URL parameters SEBELUM redirect
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);

            setStatus('Redirecting to verification...');

            navigate('/verify-email', {
              replace: true,
              state: {
                from: 'oauth-callback',
                userData: userData,
                token: token,
                isNewUser: true
              }
            });
            return;
          }

          setStatus('Logging in...');

          // ✅ PERBAIKAN: Tandai sebagai processed SEBELUM login
          hasProcessedRef.current = true;

          // Simpan data ke AuthContext
          const result = await login(token, userData);

          console.log('✅ [AUTH CALLBACK] Login successful!');
          console.log('🔍 [AUTH CALLBACK] Login result:', {
            success: result.success,
            needsProfileCompletion: result.needsProfileCompletion
          });

          // ✅ PERBAIKAN: Clear URL parameters SEBELUM redirect
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);

          setStatus('Redirecting...');

          // ✅ PERBAIKAN: Gunakan HANYA data dari loginResult
          const needsCompletion = result.needsProfileCompletion;

          console.log('🔍 [AUTH CALLBACK] Final decision:', {
            needsCompletion,
            userProfileComplete: userData.isProfileComplete,
            isEmailVerified: userData.isEmailVerified
          });

          // ✅ PERBAIKAN: Redirect langsung tanpa setTimeout berdasarkan role dan profil
          if (needsCompletion) {
            console.log('🔍 [AUTH CALLBACK] FIRST TIME USER - Redirecting to AboutYouPage');
            navigate('/about-you', {
              replace: true,
              state: {
                from: 'first-login',
                userData: userData
              }
            });
          } else if (userData.userType === 'admin') {
            console.log('🔍 [AUTH CALLBACK] ADMIN USER - Redirecting to Dashboard');
            navigate('/admin/dashboard', { replace: true });
          } else {
            console.log('🔍 [AUTH CALLBACK] RETURNING NORMAL USER - Redirecting to Chat');
            navigate('/chat', {
              replace: true,
              state: {
                from: 'auth-callback',
                welcomeBack: true
              }
            });
          }

        } catch (parseError) {
          console.error('❌ [AUTH CALLBACK] Error parsing user data:', parseError);
          setError('Invalid user data format.');
          setStatus('Data parsing failed');
          setTimeout(() => {
            navigate('/', {
              state: { error: 'Invalid user data format.' },
              replace: true
            });
          }, 2000);
        }

      } catch (error) {
        console.error('❌ [AUTH CALLBACK] Unexpected error:', error);
        setError('An unexpected error occurred.');
        setStatus('Unexpected error');
        setTimeout(() => {
          navigate('/', {
            state: { error: 'An unexpected error occurred.' },
            replace: true
          });
        }, 2000);
      } finally {
        // ✅ Reset processing flag
        processingRef.current = false;
      }
    };

    handleAuthCallback();
  }, [searchParams, navigate, login, isAuthenticated, loading]);

  // Tampilkan UI yang lebih informatif dengan status real-time
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      flexDirection: 'column',
      gap: '16px',
      backgroundColor: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '20px',
      textAlign: 'center'
    }}>
      {error ? (
        <>
          <div style={{
            width: '64px',
            height: '64px',
            backgroundColor: '#fee2e2',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <svg style={{ width: '32px', height: '32px', color: '#dc2626' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
            Authentication Failed
          </div>
          <div style={{ fontSize: '16px', color: '#6b7280', textAlign: 'center', maxWidth: '300px' }}>
            {error}
          </div>
          <div style={{ fontSize: '14px', color: '#9ca3af', marginTop: '16px' }}>
            Redirecting to home page...
          </div>
        </>
      ) : (
        <>
          <div style={{
            width: '64px',
            height: '64px',
            backgroundColor: '#dbeafe',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: '4px solid #3b82f6',
              borderTop: '4px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
            Processing Authentication
          </div>
          <div style={{ fontSize: '16px', color: '#6b7280', marginBottom: '8px' }}>
            {status}
          </div>
          <div style={{
            fontSize: '14px',
            color: '#9ca3af',
            backgroundColor: '#f1f5f9',
            padding: '8px 16px',
            borderRadius: '8px',
            maxWidth: '400px'
          }}>
            {hasProcessedRef.current ? '✓ Login processed' : '⏳ Processing login...'}
            <br />
            {loading ? '⏳ Loading auth context...' : '✓ Auth context ready'}
            <br />
            {processingRef.current ? '⏳ Processing...' : '✓ Ready to process'}
          </div>
        </>
      )}

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default AuthCallback;