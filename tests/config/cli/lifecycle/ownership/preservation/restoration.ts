/** Restoration removes a file created by its block and retains an authored file. */
export const BLOCK_CASES = [
    { name: 'the block created the file', files: {}, isCreated: true, kept: undefined },
    { name: 'the file was authored', files: { 'NOTES.md': 'Authored.\n' }, isCreated: false, kept: 'Authored.\n' },
];
/** Adopted outputs survive restoration only before their authored bytes have changed. */
export const ADOPTED_FILE_CASES = [
    { name: 'authored and unchanged', path: 'tool.json', isChanged: false, isKept: true },
    { name: 'authored and rewritten', path: 'tool.json', isChanged: true, isKept: false },
    { name: 'a private generated output', path: '.gspot/config/tool.json', isChanged: false, isKept: false },
];
