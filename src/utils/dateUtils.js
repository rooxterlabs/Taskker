export function calculateDaysOpen(createdDate) {
    if (!createdDate) return 0;
    const created = new Date(createdDate);
    const now = new Date();
    const diffTime = Math.abs(now - created);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

export function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

export function calculateTargetDeadline(dueByType) {
    const now = new Date();
    switch (dueByType) {
        case '1 hr':
            now.setHours(now.getHours() + 1);
            return now.toISOString();
        case '6 hrs':
            now.setHours(now.getHours() + 6);
            return now.toISOString();
        case 'Today':
            now.setHours(23, 59, 59, 999);
            return now.toISOString();
        case '3 days':
            now.setDate(now.getDate() + 3);
            return now.toISOString();
        case '7 days':
            now.setDate(now.getDate() + 7);
            return now.toISOString();
        case '14 days':
            now.setDate(now.getDate() + 14);
            return now.toISOString();
        case 'End of week':
            // End of week (Sunday 11:59PM)
            const dayOfWeek = now.getDay();
            const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
            now.setDate(now.getDate() + daysUntilSunday);
            now.setHours(23, 59, 59, 999);
            return now.toISOString();
        case '4 weeks':
            now.setDate(now.getDate() + 28);
            return now.toISOString();
        case 'End of Month':
            // Last day of current month, 11:59PM
            const year = now.getFullYear();
            const month = now.getMonth();
            const lastDay = new Date(year, month + 1, 0, 23, 59, 59, 999);
            return lastDay.toISOString();
        case 'Backburner':
            return null;
        default:
            return null;
    }
}

export function getPriorityFromDueByType(dueByType) {
    if (['1 hr', '6 hrs', 'Today'].includes(dueByType)) return 'P1 (Critical)';
    if (['3 days', '7 days', '14 days', 'End of week'].includes(dueByType)) return 'P2';
    if (['4 weeks', 'End of Month'].includes(dueByType)) return 'P3';
    if (dueByType === 'Backburner') return 'Backburner';
    return 'P3';
}

export function isTaskOverdue(targetDeadlineTimestamp) {
    if (!targetDeadlineTimestamp) return false;
    const target = new Date(targetDeadlineTimestamp);
    return new Date() > target;
}
