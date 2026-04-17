import { useCallback, useEffect, useState } from 'react';
import { api, CATEGORIES, STATUSES } from '../api/client';
import TicketCard from '../components/TicketCard';

export default function Feed() {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [category, setCategory] = useState('');
    const [status, setStatus] = useState('');
    const [sort, setSort] = useState('date'); // 'date' | 'upvotes'

    const fetchTickets = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const { tickets: data } = await api.listTickets({
                category: category || undefined,
                status: status || undefined,
                sort,
                order: 'desc',
            });
            setTickets(data);
        } catch (err) {
            setError(err.message || 'Failed to load tickets.');
        } finally {
            setLoading(false);
        }
    }, [category, status, sort]);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    return (
        <>
            <div className="page-header">
                <h1>Campus Concerns</h1>
                <p>Browse what your peers are raising. Upvote to push the most urgent concerns to the top.</p>
            </div>

            <div className="feed-toolbar">
                <div className="feed-toolbar-group">
                    <span className="feed-toolbar-label">Sort</span>
                    <button
                        className={'chip' + (sort === 'date' ? ' active' : '')}
                        onClick={() => setSort('date')}
                    >
                        Newest
                    </button>
                    <button
                        className={'chip' + (sort === 'upvotes' ? ' active' : '')}
                        onClick={() => setSort('upvotes')}
                    >
                        Top voted
                    </button>
                </div>

                <div className="feed-toolbar-group">
                    <span className="feed-toolbar-label">Category</span>
                    <button
                        className={'chip' + (!category ? ' active' : '')}
                        onClick={() => setCategory('')}
                    >
                        All
                    </button>
                    {CATEGORIES.map((c) => (
                        <button
                            key={c}
                            className={'chip' + (category === c ? ' active' : '')}
                            onClick={() => setCategory(c)}
                        >
                            {c}
                        </button>
                    ))}
                </div>

                <div className="feed-toolbar-group">
                    <span className="feed-toolbar-label">Status</span>
                    <button
                        className={'chip' + (!status ? ' active' : '')}
                        onClick={() => setStatus('')}
                    >
                        Any
                    </button>
                    {STATUSES.map((s) => (
                        <button
                            key={s}
                            className={'chip' + (status === s ? ' active' : '')}
                            onClick={() => setStatus(s)}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {error && <div className="form-error">{error}</div>}

            {loading ? (
                <div className="loading"><div className="spinner" /></div>
            ) : tickets.length === 0 ? (
                <div className="empty-state">
                    <h3>No tickets match your filters</h3>
                    <p>Try clearing filters, or be the first to submit a concern.</p>
                </div>
            ) : (
                <div className="ticket-list">
                    {tickets.map((t) => (
                        <TicketCard key={t.id} ticket={t} onChange={fetchTickets} />
                    ))}
                </div>
            )}
        </>
    );
}
