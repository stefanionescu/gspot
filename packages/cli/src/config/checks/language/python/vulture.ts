/**
 * A line of vulture output that gspot reports: an unused definition, or unreachable code. Ruff already reports unused
 * imports and variables, so their lines stay out.
 */
export const VULTURE_FINDING =
    /^(?<file>.+?):(?<line>\d+): (?:unused (?<kind>attribute|class|function|method|property) '(?<name>[^']+)'|unreachable code after '(?<statement>[^']+)') \(\d+% confidence/u;

export const VULTURE_COMMAND = ['vulture'] as const;

export const VULTURE_DEAD_CODE = 3;
