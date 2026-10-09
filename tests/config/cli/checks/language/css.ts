/** Dynamic access and object rest can read class names that static analysis cannot list. */
export const DYNAMIC_READS = [
    { name: 'computed access', source: 'export const chosen = styles[process.argv[2]];' },
    { name: 'object rest', source: 'export const { card, ...remaining } = styles;' },
];
