/** Native copy and read failures name their own operation while their scratch folder is removed. */
export const SCRATCH_FAILURES = [
    { operation: 'copy', diagnostic: 'copyfile' },
    { operation: 'read', diagnostic: 'EISDIR' },
];
