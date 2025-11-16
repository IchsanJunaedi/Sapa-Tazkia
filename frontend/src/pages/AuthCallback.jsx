import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, isAuthenticated, needsProfileCompletion } = useAuth();
  const [hasProcessed, setHasProcessed] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // ✅ PERBAIKAN: Cegah multiple execution dengan flag
    if (hasProcessed) {
      console.log('🔍 [AUTH CALLBACK] Already processed, skipping');
      return;
    }

    // ✅ PERBAIKAN: Jika sudah authenticated, handle redirect ke LANDING PAGE
    if (isAuthenticated) {
      console.log('🔍 [AUTH CALLBACK] Already authenticated, redirecting to LANDING PAGE');
      navigate('/', { replace: true });
      return;
    }

    const handleAuthCallback = async () => {
      try {
        // Ambil semua parameter dari URL
        const token = searchParams.get('token');
        const userParam = searchParams.get('user');
        const success = searchParams.get('success');

        console.log('🔍 [AUTH CALLBACK] URL Parameters:', {
          token: token ? '✓ Available' : '✗ Missing',
          userParam: userParam ? '✓ Available' : '✗ Missing', 
          success,
          fullURL: window.location.href
        });

        // Validasi parameter
        if (success !== 'true') {
          console.error('❌ [AUTH CALLBACK] OAuth failed - success parameter is not true');
          setError('Authentication failed. Please try again.');
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
          setTimeout(() => {
            navigate('/', { 
              state: { error: 'Missing authentication data.' },
              replace: true 
            });
          }, 2000);
          return;
        }

        try {
          // Parse user data
          const userData = JSON.parse(decodeURIComponent(userParam));
          
          console.log('✅ [AUTH CALLBACK] Parsed user data:', userData);

          // ✅ PERBAIKAN: Set flag sebelum memproses login
          setHasProcessed(true);

          // Simpan data ke AuthContext
          const result = await login(token, userData);
          
          console.log('✅ [AUTH CALLBACK] Login successful, checking if first time login...');
          console.log('🔍 [AUTH CALLBACK] Login result:', result);
          
          // ✅ PERBAIKAN KRITIS: Check jika user PERLU mengisi profile (first time)
          const needsCompletion = result.needsProfileCompletion || needsProfileCompletion();
          
          console.log('🔍 [AUTH CALLBACK] Profile completion check:', { needsCompletion });

          // ✅ PERBAIKAN: Clear URL parameters untuk hindari re-trigger
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
          
          // ✅ PERBAIKAN KRITIS: Redirect logic yang BENAR
          if (needsCompletion) {
            // ✅ FIRST TIME: User belum pernah isi profile, arahkan ke AboutYouPage
            console.log('🔍 [AUTH CALLBACK] FIRST TIME USER - Redirecting to AboutYouPage');
            setTimeout(() => {
              navigate('/about-you', { 
                replace: true,
                state: { 
                  from: 'first-login',
                  userEmail: userData.email 
                }
              });
            }, 500);
          } else {
            // ✅ RETURNING USER: Sudah pernah isi profile, arahkan ke LANDING PAGE
            console.log('🔍 [AUTH CALLBACK] RETURNING USER - Redirecting to LANDING PAGE');
            setTimeout(() => {
              navigate('/', { 
                replace: true,
                state: { 
                  from: 'google-auth',
                  welcomeBack: true 
                }
              });
            }, 500);
          }
          
        } catch (parseError) {
          console.error('❌ [AUTH CALLBACK] Error parsing user data:', parseError);
          setError('Invalid user data format.');
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
        setTimeout(() => {
          navigate('/', { 
            state: { error: 'An unexpected error occurred.' },
            replace: true 
          });
        }, 2000);
      }
    };

    handleAuthCallback();
  }, [searchParams, navigate, login, hasProcessed, isAuthenticated, needsProfileCompletion]);

  // Tampilkan UI yang lebih informatif
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      flexDirection: 'column',
      gap: '16px',
      backgroundColor: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
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
          <div style={{ fontSize: '16px', color: '#6b7280' }}>
            Please wait while we log you in...
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