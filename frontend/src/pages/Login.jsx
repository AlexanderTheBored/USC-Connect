import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const { login, isAuthenticated } = useAuth();
    const location = useLocation();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const redirectTo = location.state?.from || '/feed';

    if (isAuthenticated) {
        return <Navigate to={redirectTo} replace />;
    }

    const handleSuccess = async (credentialResponse) => {
        if (!credentialResponse.credential) {
            setError('Google did not return a credential. Please try again.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            await login(credentialResponse.credential);
            // AuthProvider updates state; the guard above re-renders to redirect.
        } catch (err) {
            setError(err.message || 'Login failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-wrap">
            <div className="login-card">
                <h1>USC Centralized Routing System</h1>
                <p>Sign in with your USC Google account to submit and track campus concerns.</p>

                <div className="domain-notice">
                    🔒 Only <strong>@usc.edu.ph</strong> accounts are accepted.
                </div>

                {error && <div className="form-error">{error}</div>}

                {loading ? (
                    <div className="loading"><div className="spinner" /></div>
                ) : (
                    <div className="google-btn-wrap">
                        <GoogleLogin
                            onSuccess={handleSuccess}
                            onError={() => setError('Google sign-in was cancelled or failed.')}
                            hd="usc.edu.ph"
                            useOneTap={false}
                            theme="filled_blue"
                            size="large"
                            text="signin_with"
                            shape="pill"
                        />
                    </div>
                )}

                <p className="text-sm text-muted mt-2">
                    By signing in you agree to use this platform in good faith to raise and resolve
                    legitimate concerns. Misuse may result in account restrictions.
                </p>
            </div>
        </div>
    );
}
