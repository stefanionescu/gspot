/** Forty JSON records, so two identical copies of them pass the clone limit. */
export const DUPLICATED_METADATA = JSON.stringify(
    Array.from({ length: 40 }, (_, value) => ({ name: `entry-${String(value)}`, value })),
    null,
    4,
);

/** Thirty counting steps, so two copies of a function that runs them pass the clone limit. */
const COUNT_STEPS = Array.from(
    { length: 30 },
    (_, index) => `    printf 'step %s of %s\\n' "${String(index)}" "$total"\n    total=$((total + ${String(index)}))`,
).join('\n');

/**
 * Build a Bash script whose one function runs the counting steps.
 *
 * @param name what the script calls its function.
 * @returns the source of the Bash script.
 */
export function buildCountScript(name: string): string {
    return `#!/usr/bin/env bash\nset -euo pipefail\n\n${name}() {\n    local total=0\n${COUNT_STEPS}\n    printf '%s\\n' "$total"\n}\n\n${name}\n`;
}

/** Twelve imports that two TypeScript files share. */
export const SHARED_IMPORTS = Array.from(
    { length: 12 },
    (_, index) => `import { value${String(index)} } from './values/value-${String(index)}.ts';`,
).join('\n');
