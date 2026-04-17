export function CategoryBadge({ category }) {
    return <span className="badge badge-category">{category}</span>;
}

export function StatusBadge({ status }) {
    // The CSS classes use hyphens in place of spaces.
    const cls = `badge badge-status-${status.replace(/\s+/g, '-')}`;
    return <span className={cls}>{status}</span>;
}

export function AdminBadge() {
    return <span className="badge badge-admin">ADMIN</span>;
}
