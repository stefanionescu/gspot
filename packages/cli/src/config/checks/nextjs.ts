const CAUSE_MARKS = ['Please install', 'FATAL', 'Error:', '⨯'] as const;

const SHOWN_LINES = 3;

// The marked line and the one after it.
const MARKED_LINES = 2;

const NEXT_TYPEGEN_COMMAND = ['next', 'typegen'] as const;
const CI_ENVIRONMENT = { CI: '1' } as const;

export { CAUSE_MARKS, SHOWN_LINES, MARKED_LINES, CI_ENVIRONMENT, NEXT_TYPEGEN_COMMAND };
