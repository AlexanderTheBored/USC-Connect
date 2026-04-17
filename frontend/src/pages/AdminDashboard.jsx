import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, STATUSES } from '../api/client';
import { useAuth } from '../context/AuthContext';

function formatDate(iso) {
    return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function AdminDashboard() {
    const { user } = useAuth();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [updating, setUpdating] = useState(null); // ticket id being mutated

    const fetchTickets = useCallback(async () => {
        if (!user?.admin_category) return;
        setLoading(true);
        try {
            const { tickets: data } = await api.listTickets({
                category: user.admin_category,
                sort: 'upvotes',
                order: 'desc',
            });
            setTickets(data);
            setError('');
        } catch (err) {
            setError(err.message || 'Failed to load tickets.');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    const byStatus = useMemo(() => {
        const groups = { Pending: [], 'Under Review': [], Resolved: [] };
        for (const t of tickets) {
            if (groups[t.status]) groups[t.status].push(t);
        }
        return groups;
    }, [tickets]);

    const handleStatusChange = async (ticket, newStatus) => {
        if (ticket.status === newStatus) return;
        setUpdating(ticket.id);
        try {
            await api.updateStatus(ticket.id, newStatus);
            setTickets((prev) => prev.map((t) => (t.id === ticket.id ? { ...t, status: newStatus } : t)));
        } catch (err) {
            setError(err.message || 'Failed to update status.');
        } finally {
            setUpdating(null);
        }
    };

    return (
        <>
            <div className="page-header">
                <h1>Admin Dashboard</h1>
                <p>
                    Showing tickets routed to your department:{' '}
                    <strong>{user?.admin_category}</strong>. Drag-less Kanban — click a status chip to move a ticket.
                </p>
            </div>

            {error && <div className="form-error">{error}</div>}

            {loading ? (
                <div className="loading"><div className="spinner" /></div>
            ) : tickets.length === 0 ? (
                <div className="empty-state">
                    <h3>No tickets routed to {user?.admin_category} yet</h3>
                    <p>When students submit concerns in your category they'll appear here.</p>
                </div>
            ) : (
                <div className="kanban">
                    {STATUSES.map((status) => (
                        <div key={status} className="kanban-column">
                            <h3>
                                <span>{status}</span>
                                <span className="count">{byStatus[status].length}</span>
                            </h3>
                            {byStatus[status].length === 0 && (
                                <div className="text-muted text-sm" style={{ padding: '0.5rem' }}>
                                    Nothing here.
                                </div>
                            )}
                            {byStatus[status].map((t) => (
                                <article key={t.id} className="kanban-card">
                                    <h4>
                                        <Link to={`/tickets/${t.id}`}>{t.title}</Link>
                                    </h4>
                                    <div className="meta">
                                        ▲ {t.upvote_count} · {t.author_name || t.author_email} · {formatDate(t.created_at)}
                                    </div>
                                    <div className="status-toggles">
                                        {STATUSES.map((s) => (
                                            <button
                                                key={s}
                                                className={'status-toggle' + (t.status === s ? ' active' : '')}
                                                onClick={() => handleStatusChange(t, s)}
                                                disabled={updating === t.id}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </article>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
