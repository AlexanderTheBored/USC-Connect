import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Wrap a route element to require auth. If `adminOnly` is true, only admins pass.
 *
 * Usage:
 *   <Route path="/submit" element={<ProtectedRoute><Submit /></ProtectedRoute>} />
 *   <Route path="/admin"  element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
 */
export default function ProtectedRoute({ children, adminOnly = false }) {
    const { isAuthenticated, isAdmin, initializing } = useAuth();
    const location = useLocation();

    if (initializing) {
        return (
            <div className="loading">
                <div className="spinner" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location.pathname }} replace />;
    }

    if (adminOnly && !isAdmin) {
        return <Navigate to="/feed" replace />;
    }

    return children;
}
