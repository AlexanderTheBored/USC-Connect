import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

import Login from './pages/Login';
import Feed from './pages/Feed';
import Submit from './pages/Submit';
import MyConcerns from './pages/MyConcerns';
import TicketDetail from './pages/TicketDetail';
import AdminDashboard from './pages/AdminDashboard';

function RootRedirect() {
    const { isAuthenticated, initializing } = useAuth();
    if (initializing) {
        return <div className="loading"><div className="spinner" /></div>;
    }
    return <Navigate to={isAuthenticated ? '/feed' : '/login'} replace />;
}

function Shell() {
    return (
        <div className="app-shell">
            <Navbar />
            <main className="main-content">
                <Routes>
                    <Route path="/" element={<RootRedirect />} />
                    <Route path="/login" element={<Login />} />

                    <Route
                        path="/feed"
                        element={<ProtectedRoute><Feed /></ProtectedRoute>}
                    />
                    <Route
                        path="/submit"
                        element={<ProtectedRoute><Submit /></ProtectedRoute>}
                    />
                    <Route
                        path="/my-concerns"
                        element={<ProtectedRoute><MyConcerns /></ProtectedRoute>}
                    />
                    <Route
                        path="/tickets/:id"
                        element={<ProtectedRoute><TicketDetail /></ProtectedRoute>}
                    />
                    <Route
                        path="/admin"
                        element={
                            <ProtectedRoute adminOnly>
                                <AdminDashboard />
                            </ProtectedRoute>
                        }
                    />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
        </div>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Shell />
            </BrowserRouter>
        </AuthProvider>
    );
}
