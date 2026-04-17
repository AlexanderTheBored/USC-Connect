import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
    const { user, isAuthenticated, isAdmin, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <nav className="navbar">
            <div className="navbar-inner">
                <Link to={isAuthenticated ? '/feed' : '/login'} className="navbar-brand">
                    <span>USC Routing</span>
                    <span className="navbar-brand-badge">BETA</span>
                </Link>

                {isAuthenticated && (
                    <div className="navbar-links">
                        <NavLink to="/feed" className={({ isActive }) => 'navbar-link' + (isActive ? ' active' : '')}>
                            Feed
                        </NavLink>
                        <NavLink to="/submit" className={({ isActive }) => 'navbar-link' + (isActive ? ' active' : '')}>
                            Submit
                        </NavLink>
                        <NavLink to="/my-concerns" className={({ isActive }) => 'navbar-link' + (isActive ? ' active' : '')}>
                            My Concerns
                        </NavLink>
                        {isAdmin && (
                            <NavLink to="/admin" className={({ isActive }) => 'navbar-link' + (isActive ? ' active' : '')}>
                                Admin
                            </NavLink>
                        )}
                    </div>
                )}

                {isAuthenticated && (
                    <div className="navbar-user">
                        {user.picture_url && <img src={user.picture_url} alt={user.full_name || user.email} />}
                        <div className="navbar-user-meta">
                            <div>{user.full_name || user.email}</div>
                            <div className="role">
                                {user.role === 'admin' ? `Admin · ${user.admin_category}` : 'Student'}
                            </div>
                        </div>
                        <button className="navbar-logout" onClick={handleLogout}>
                            Log out
                        </button>
                    </div>
                )}
            </div>
        </nav>
    );
}
