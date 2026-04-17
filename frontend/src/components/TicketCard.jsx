import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CategoryBadge, StatusBadge } from './Badges';

function formatDate(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString();
}

export default function TicketCard({ ticket, onChange }) {
    const { isAuthenticated } = useAuth();
    const [voting, setVoting] = useState(false);
    const [hasUpvoted, setHasUpvoted] = useState(!!ticket.has_upvoted);
    const [count, setCount] = useState(Number(ticket.upvote_count));

    const handleVote = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isAuthenticated || voting) return;
        setVoting(true);

        // Optimistic update for snappy UX.
        const previous = { hasUpvoted, count };
        setHasUpvoted(!hasUpvoted);
        setCount((c) => (hasUpvoted ? c - 1 : c + 1));

        try {
            const result = await api.toggleUpvote(ticket.id);
            setHasUpvoted(result.has_upvoted);
            setCount(Number(result.upvote_count));
            if (onChange) onChange();
        } catch (err) {
            // Roll back on failure.
            setHasUpvoted(previous.hasUpvoted);
            setCount(previous.count);
            console.error('Vote failed:', err.message);
        } finally {
            setVoting(false);
        }
    };

    return (
        <article className="ticket-card">
            <div className="ticket-vote">
                <button
                    className={'vote-btn' + (hasUpvoted ? ' voted' : '')}
                    onClick={handleVote}
                    disabled={!isAuthenticated || voting}
                    aria-label={hasUpvoted ? 'Remove upvote' : 'Upvote'}
                    title={isAuthenticated ? 'Click to upvote (or remove your upvote)' : 'Log in to vote'}
                >
                    ▲
                </button>
                <span className="vote-count">{count}</span>
            </div>

            <div className="ticket-body-col">
                <h3 className="ticket-title">
                    <Link to={`/tickets/${ticket.id}`}>{ticket.title}</Link>
                </h3>

                <p className="ticket-snippet clamped">{ticket.body}</p>

                <div className="ticket-meta">
                    <CategoryBadge category={ticket.category} />
                    <StatusBadge status={ticket.status} />
                    <span>· by {ticket.author_name || ticket.author_email}</span>
                    <span>· {formatDate(ticket.created_at)}</span>
                </div>
            </div>
        </article>
    );
}
