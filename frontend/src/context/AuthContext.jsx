import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [initializing, setInitializing] = useState(true);

    // On first load, if a token exists, validate it against /auth/me.
    useEffect(() => {
        let cancelled = false;

        (async () => {
            const token = getToken();
            if (!token) {
                if (!cancelled) setInitializing(false);
                return;
            }
            try {
                const { user: me } = await api.me();
                if (!cancelled) setUser(me);
            } catch {
                // Token invalid/expired — clear it.
                setToken(null);
            } finally {
                if (!cancelled) setInitializing(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const login = useCallback(async (credential) => {
        const { token, user: me } = await api.login(credential);
        setToken(token);
        setUser(me);
        return me;
    }, []);

    const logout = useCallback(() => {
        setToken(null);
        setUser(null);
    }, []);

    const value = {
        user,
        initializing,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        login,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
