/**
 * Thin fetch wrapper used by the whole app.
 *
 * - Prefixes every request with VITE_API_URL
 * - Automatically attaches the JWT from localStorage
 * - Parses JSON and throws a rich Error on non-2xx responses
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const TOKEN_KEY = 'usc_routing_token';

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
    constructor(status, message, payload) {
        super(message);
        this.status = status;
        this.payload = payload;
    }
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };

    if (auth) {
        const token = getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    // 204 No Content
    if (response.status === 204) return null;

    let payload = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        payload = await response.json().catch(() => null);
    }

    if (!response.ok) {
        const message = (payload && payload.error) || `Request failed with ${response.status}`;
        throw new ApiError(response.status, message, payload);
    }

    return payload;
}

export const api = {
    login: (credential) => request('/auth/login', { method: 'POST', body: { credential }, auth: false }),
    me: () => request('/auth/me'),

    listTickets: (params = {}) => {
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null && v !== '') qs.set(k, v);
        }
        const suffix = qs.toString() ? `?${qs.toString()}` : '';
        return request(`/tickets${suffix}`);
    },
    getTicket: (id) => request(`/tickets/${id}`),
    createTicket: (data) => request('/tickets', { method: 'POST', body: data }),
    toggleUpvote: (id) => request(`/tickets/${id}/upvote`, { method: 'POST' }),
    updateStatus: (id, status) => request(`/tickets/${id}/status`, { method: 'PUT', body: { status } }),
    respond: (id, body) => request(`/tickets/${id}/respond`, { method: 'POST', body: { body } }),
};

export const CATEGORIES = ['Academic', 'Facilities', 'Admin/Registrar', 'IT Services'];
export const STATUSES = ['Pending', 'Under Review', 'Resolved'];
