import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';
import './styles/index.css';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

if (!clientId) {
    // Surface config errors visibly instead of a silent failure inside the button.
    const root = document.getElementById('root');
    if (root) {
        root.innerHTML =
            '<div style="padding:2rem;font-family:sans-serif;">' +
            '<h2>Configuration error</h2>' +
            '<p>VITE_GOOGLE_CLIENT_ID is not set. Copy <code>.env.example</code> to <code>.env</code> ' +
            'and fill in your Google OAuth Client ID.</p>' +
            '</div>';
    }
} else {
    createRoot(document.getElementById('root')).render(
        <StrictMode>
            <GoogleOAuthProvider clientId={clientId}>
                <App />
            </GoogleOAuthProvider>
        </StrictMode>
    );
}
