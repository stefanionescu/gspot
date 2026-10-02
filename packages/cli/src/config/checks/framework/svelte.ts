// The literal values checks/framework/svelte reads: names, patterns, limits, and tables.

// svelte-check writes each diagnostic on a line of its own: a timestamp, then the diagnostic as JSON.
export const DIAGNOSTIC_LINE = /^\d+ (?<diagnostic>\{.*\})$/u;
export const FAILURE_LINE = /^\d+ FAILURE (?<message>".*")$/u;
