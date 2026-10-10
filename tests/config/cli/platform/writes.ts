// Distinct failures at the asynchronous flush boundary.
export const FLUSH_FAILURES = [
    { name: 'injected flush failure', change: false, message: 'Injected flush failure' },
    { name: 'changed temporary file', change: true, message: 'Lifecycle destination changed during the operation' },
] as const;
