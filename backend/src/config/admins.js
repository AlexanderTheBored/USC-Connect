/**
 * Parses the ADMIN_CONFIG environment variable into a lookup map.
 *
 * Expected format:
 *   ADMIN_CONFIG=email1@usc.edu.ph:Category,email2@usc.edu.ph:Category
 *
 * Allowed categories: Academic, Facilities, Admin/Registrar, IT Services
 */

const ALLOWED_CATEGORIES = new Set([
    'Academic',
    'Facilities',
    'Admin/Registrar',
    'IT Services',
]);

function parseAdminConfig(raw) {
    const map = new Map();
    if (!raw || typeof raw !== 'string') return map;

    for (const entry of raw.split(',')) {
        const trimmed = entry.trim();
        if (!trimmed) continue;

        const sep = trimmed.lastIndexOf(':');
        if (sep === -1) {
            console.warn(`[admins] Skipping malformed ADMIN_CONFIG entry: "${trimmed}"`);
            continue;
        }

        const email = trimmed.slice(0, sep).trim().toLowerCase();
        const category = trimmed.slice(sep + 1).trim();

        if (!email.includes('@') || !ALLOWED_CATEGORIES.has(category)) {
            console.warn(`[admins] Skipping invalid ADMIN_CONFIG entry: "${trimmed}"`);
            continue;
        }

        map.set(email, category);
    }

    return map;
}

const adminMap = parseAdminConfig(process.env.ADMIN_CONFIG);

/**
 * @param {string} email - user's email address
 * @returns {{ role: 'admin' | 'student', admin_category: string | null }}
 */
function resolveRoleForEmail(email) {
    if (!email) return { role: 'student', admin_category: null };
    const category = adminMap.get(email.toLowerCase());
    return category
        ? { role: 'admin', admin_category: category }
        : { role: 'student', admin_category: null };
}

module.exports = {
    ALLOWED_CATEGORIES,
    resolveRoleForEmail,
    adminMap, // exported for debugging / health checks
};
