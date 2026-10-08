/** Interrupted swaps keep either the recovered original or the fully published folder. */
export const SWAP_CASES = [
    { name: 'the new folder is missing', files: {}, kept: 'previous\n' },
    {
        name: 'the new folder is present',
        files: { '.gspot/node_modules/tool/index.js': 'swapped\n' },
        kept: 'swapped\n',
    },
];
