import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, CATEGORIES } from '../api/client';

export default function Submit() {
    const navigate = useNavigate();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [category, setCategory] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (title.trim().length < 5) {
            setError('Title must be at least 5 characters.');
            return;
        }
        if (body.trim().length < 10) {
            setError('Please describe your concern in at least 10 characters.');
            return;
        }
        if (!category) {
            setError('Please choose a category so we can route this to the right department.');
            return;
        }

        setSubmitting(true);
        try {
            const { ticket } = await api.createTicket({
                title: title.trim(),
                body: body.trim(),
                category,
            });
            navigate(`/tickets/${ticket.id}`);
        } catch (err) {
            setError(err.message || 'Failed to submit. Try again.');
            setSubmitting(false);
        }
    };

    return (
        <>
            <div className="page-header">
                <h1>Submit a Concern</h1>
                <p>
                    Your post will be routed to the department matching the category you select.
                    Be specific — context helps admins act faster.
                </p>
            </div>

            <form className="form-card" onSubmit={handleSubmit}>
                {error && <div className="form-error">{error}</div>}

                <div className="form-field">
                    <label htmlFor="title">Title</label>
                    <input
                        id="title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={200}
                        placeholder="One-line summary of your concern"
                        required
                    />
                    <div className="form-hint">{title.length} / 200</div>
                </div>

                <div className="form-field">
                    <label htmlFor="category">Category</label>
                    <select
                        id="category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        required
                    >
                        <option value="">Select a category…</option>
                        {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                    <div className="form-hint">
                        This determines which admin dashboard receives your concern.
                    </div>
                </div>

                <div className="form-field">
                    <label htmlFor="body">Details</label>
                    <textarea
                        id="body"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="What happened? When? Where on campus? What would a resolution look like?"
                        required
                    />
                    <div className="form-hint">{body.length} characters</div>
                </div>

                <div className="row-gap">
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                        {submitting ? 'Submitting…' : 'Submit concern'}
                    </button>
                    <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => navigate('/feed')}
                        disabled={submitting}
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </>
    );
}
