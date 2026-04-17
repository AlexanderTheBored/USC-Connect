import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api, STATUSES } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CategoryBadge, StatusBadge, AdminBadge } from '../components/Badges';

function formatDateTime(iso) {
    return new Date(iso).toLocaleString();
}

export default function TicketDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, isAuthenticated, isAdmin } = useAuth();

    const [ticket, setTicket] = useState(null);
    const [responses, setResponses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [replyBody, setReplyBody] = useState('');
    const [replying, setReplying] = useState(false);
    const [replyError, setReplyError] = useState('');

    const [statusUpdating, setStatusUpdating] = useState(false);
    const [statusError, setStatusError] = useState('');

    const [upvoting, setUpvoting] = useState(false);

    const fetchTicket = useCallback(async () => {
        try {
            const data = await api.getTicket(id);
            setTicket(data.ticket);
            setResponses(data.responses);
            setError('');
        } catch (err) {
            setError(err.message || 'Failed to load ticket.');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        setLoading(true);
        fetchTicket();
    }, [fetchTicket]);

    const handleVote = async () => {
        if (!isAuthenticated || upvoting || !ticket) return;
        setUpvoting(true);
        try {
            const result = await api.toggleUpvote(ticket.id);
            setTicket((prev) => ({ ...prev, has_upvoted: result.has_upvoted, upvote_count: result.upvote_count }));
        } catch (err) {
            console.error(err);
        } finally {
            setUpvoting(false);
        }
    };

    const handleReply = async (e) => {
        e.preventDefault();
        setReplyError('');
        if (replyBody.trim().length < 1) {
            setReplyError('Please write something.');
            return;
        }
        setReplying(true);
        try {
            const { response } = await api.respond(ticket.id, replyBody.trim());
            setResponses((prev) => {
                const updated = [...prev, response];
                // Keep officials pinned at top, then chronological.
                return updated.sort((a, b) => {
                    if (a.is_official_admin_response !== b.is_official_admin_response) {
                        return a.is_official_admin_response ? -1 : 1;
                    }
                    return new Date(a.created_at) - new Date(b.created_at);
                });
            });
            setReplyBody('');
        } catch (err) {
            setReplyError(err.message || 'Failed to post response.');
        } finally {
            setReplying(false);
        }
    };

    const handleStatusChange = async (newStatus) => {
        if (newStatus === ticket.status || statusUpdating) return;
        setStatusError('');
        setStatusUpdating(true);
        try {
            const { ticket: updated } = await api.updateStatus(ticket.id, newStatus);
            setTicket((prev) => ({ ...prev, ...updated }));
        } catch (err) {
            setStatusError(err.message || 'Failed to update status.');
        } finally {
            setStatusUpdating(false);
        }
    };

    if (loading) {
        return <div className="loading"><div className="spinner" /></div>;
    }

    if (error || !ticket) {
        return (
            <div className="empty-state">
                <h3>Ticket unavailable</h3>
                <p>{error || 'This concern could not be loaded.'}</p>
                <button className="btn btn-outline mt-2" onClick={() => navigate('/feed')}>
                    Back to feed
                </button>
            </div>
        );
    }

    // Admins can act on this ticket only if their department matches the category.
    const canAdminAct = isAdmin && user?.admin_category === ticket.category;

    return (
        <>
            <div className="ticket-detail">
                <div className="ticket-detail-meta">
                    <CategoryBadge category={ticket.category} />
                    <StatusBadge status={ticket.status} />
                    <span>
                        by <strong>{ticket.author_name || ticket.author_email}</strong>
                        {ticket.author_role === 'admin' && <> <AdminBadge /></>}
                    </span>
                    <span>· submitted {formatDateTime(ticket.created_at)}</span>
                </div>

                <h1>{ticket.title}</h1>
                <div className="body">{ticket.body}</div>

                <div className="ticket-actions">
                    <button
                        className={'btn btn-outline' + (ticket.has_upvoted ? ' btn-primary' : '')}
                        onClick={handleVote}
                        disabled={!isAuthenticated || upvoting}
                        style={ticket.has_upvoted ? { background: 'var(--color-navy)', color: 'white', borderColor: 'var(--color-navy)' } : {}}
                    >
                        ▲ {ticket.has_upvoted ? 'Upvoted' : 'Upvote'} · {ticket.upvote_count}
                    </button>
                    <Link to="/feed" className="btn btn-outline">← Back to feed</Link>
                </div>

                {canAdminAct && (
                    <div className="ticket-actions" style={{ marginTop: '0.75rem' }}>
                        <span className="feed-toolbar-label" style={{ alignSelf: 'center' }}>
                            Change status:
                        </span>
                        {STATUSES.map((s) => (
                            <button
                                key={s}
                                className={'status-toggle' + (ticket.status === s ? ' active' : '')}
                                onClick={() => handleStatusChange(s)}
                                disabled={statusUpdating}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}
                {statusError && <div className="form-error mt-2">{statusError}</div>}
            </div>

            <section className="responses-section">
                <h2>
                    Responses
                    <span className="text-muted text-sm" style={{ fontWeight: 400, marginLeft: 8 }}>
                        ({responses.length})
                    </span>
                </h2>

                {responses.length === 0 && (
                    <div className="empty-state">
                        <p>No responses yet. Be the first — or wait for an official admin reply.</p>
                    </div>
                )}

                {responses.map((r) => (
                    <article
                        key={r.id}
                        className={'response-card' + (r.is_official_admin_response ? ' official' : '')}
                    >
                        <div className="response-author">
                            <span>{r.author_name || r.author_email}</span>
                            {r.author_role === 'admin' && !r.is_official_admin_response && <AdminBadge />}
                            <span className="response-time">· {formatDateTime(r.created_at)}</span>
                            {r.is_official_admin_response && r.author_admin_category && (
                                <CategoryBadge category={r.author_admin_category} />
                            )}
                        </div>
                        <div className="response-body">{r.body}</div>
                    </article>
                ))}

                {isAuthenticated && (
                    <form className="form-card mt-2" onSubmit={handleReply}>
                        {replyError && <div className="form-error">{replyError}</div>}
                        <div className="form-field">
                            <label htmlFor="reply">
                                {canAdminAct
                                    ? 'Post an official response'
                                    : 'Add a comment'}
                            </label>
                            <textarea
                                id="reply"
                                value={replyBody}
                                onChange={(e) => setReplyBody(e.target.value)}
                                placeholder={
                                    canAdminAct
                                        ? 'Your response will be pinned and marked as official.'
                                        : 'Share your thoughts or additional context.'
                                }
                                maxLength={4000}
                            />
                            <div className="form-hint">{replyBody.length} / 4000</div>
                        </div>
                        <button className="btn btn-primary" disabled={replying}>
                            {replying ? 'Posting…' : canAdminAct ? 'Post official response' : 'Post comment'}
                        </button>
                    </form>
                )}
            </section>
        </>
    );
}
