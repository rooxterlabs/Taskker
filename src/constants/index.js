export const STATUS_OPTIONS = [
    { value: 'To Do', label: 'To Do', color: 'slate' },
    { value: 'In Progress', label: 'In Progress', color: 'blue' },
    { value: 'At Risk', label: 'At Risk', color: 'orange' },
    { value: 'Blocked', label: 'Blocked', color: 'red' },
    { value: 'Done', label: 'Done', color: 'emerald' }
];

export const DUE_BY_OPTIONS = ['1 hr', '6 hrs', 'Today', '3 days', '7 days', '14 days', 'End of week', '4 weeks', 'End of Month', 'Backburner'];

export const PRIORITY_OPTIONS = [
    { value: 'P1 (Critical)', label: 'P1 (Critical)' },
    { value: 'P2', label: 'P2' },
    { value: 'P3', label: 'P3' },
    { value: 'Backburner', label: 'Backburner' }
];

// Note: ENERGY_OPTIONS, etc. are preserved if used elsewhere, but not explicitly requested.
export const ENERGY_LEVELS = ['Low', 'Medium', 'High'];
