import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import TicketCard from '../components/TicketCard';

export default function MyConcerns() {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchMine = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const { tickets: data } = await api.listTickets({ mine: 'true', sort: 'date' });
            setTickets(data);
        } catch (err) {
            setError(err.message || 'Failed to load your tickets.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMine();
    }, [fetchMine]);

    return (
        <>
            <div className="page-header">
                <h1>My Concerns</h1>
                <p>Every concern you've submitted and its current status.</p>
            </div>

            {error && <div className="form-error">{error}</div>}

            {loading ? (
                <div className="loading"><div className="spinner" /></div>
            ) : tickets.length === 0 ? (
                <div className="empty-state">
                    <h3>You haven't submitted any concerns yet</h3>
                    <p>
                        See something on campus that needs attention?{' '}
                        <Link to="/submit">Submit your first concern</Link>.
                    </p>
                </div>
            ) : (
                <div className="ticket-list">
                    {tickets.map((t) => (
                        <TicketCard key={t.id} ticket={t} onChange={fetchMine} />
                    ))}
                </div>
            )}
        </>
    );
}
