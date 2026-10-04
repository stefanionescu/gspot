export const DIAGNOSTIC = { Line: 1, Span: [3, 5], Check: 'gspot.Example', Message: 'Use a concrete example.' };

/** Process failures must remain execution errors even when Vale prints no alerts. */
export const EXECUTION_FAILURES = [
    { name: 'deadline', flags: { isTimedOut: true }, diagnostic: 'ran past 1 seconds' },
    { name: 'cancellation', flags: { isCanceled: true }, diagnostic: 'was canceled' },
];
