import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
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
          navigate('/login', { 
            state: { error: 'Authentication failed. Please try again.' },
            replace: true 
          });
          return;
        }

        if (!token || !userParam) {
          console.error('❌ [AUTH CALLBACK] Missing token or user data');
          navigate('/login', { 
            state: { error: 'Missing authentication data.' },
            replace: true 
          });
          return;
        }

        try {
          // Parse user data
          const userData = JSON.parse(decodeURIComponent(userParam));
          
          console.log('✅ [AUTH CALLBACK] Parsed user data:', userData);

          // Simpan data ke AuthContext
          await login(token, userData);
          
          console.log('✅ [AUTH CALLBACK] Login successful, redirecting to chat...');
          
          // Redirect ke halaman chat
          navigate('/chat', { replace: true });
          
        } catch (parseError) {
          console.error('❌ [AUTH CALLBACK] Error parsing user data:', parseError);
          navigate('/login', { 
            state: { error: 'Invalid user data format.' },
            replace: true 
          });
        }

      } catch (error) {
        console.error('❌ [AUTH CALLBACK] Unexpected error:', error);
        navigate('/login', { 
          state: { error: 'An unexpected error occurred.' },
          replace: true 
        });
      }
    };

    handleAuthCallback();
  }, [searchParams, navigate, login]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
        Processing authentication...
      </div>
      <div style={{ fontSize: '14px', color: '#666' }}>
        Please wait while we log you in.
      </div>
    </div>
  );
};

export default AuthCallback;