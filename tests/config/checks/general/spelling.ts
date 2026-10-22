/**
 * Deliberate misspellings for the spelling tests. The typos check leaves this one file out, so every test file stays
 * checked, and the check reports a real typo in a test.
 */
export const TYPO = {
    the: 'teh',
    color: 'colour',
    receive: 'recieve',
    whether: 'wether',
    word: 'wrod',
    spelling: 'speling',
    select: 'SELEC',
} as const;
