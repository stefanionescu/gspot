import type { DriftEntry } from '#cli/emit/drift.ts';
import type { Finding } from '#cli/output/schema.ts';
// Does every generated file match its render? Runs apply --dry-run in memory.
import type { EngineInput } from '#cli/checks/input.ts';

const MESSAGES: Record<DriftEntry['kind'], string> = {
    changed: 'This generated file differs from what gspot.toml renders.',
    missing: 'This generated file is missing.',
    stray: 'This file carries the gspot header but nothing in the selection renders it.',
};
const MOVE_HELP =
    'Change policy in gspot.toml, then run gspot apply. Edited outputs are preserved; move them aside to regenerate.';
const STRAY_HELP = 'Delete the file, or add the configuration that renders it.';

/**
 * One finding per generated file that differs from its render, is missing, or is a stray gspot file.
 * @param input the engine input
 * @returns the findings
 */
export function generatedDrift(input: EngineInput): Finding[] {
    if (input.generatedDrift === undefined) throw new Error('Generated drift requires once-only execution.');
    return input.generatedDrift().map((entry) => ({
        check: input.spec.name,
        file: entry.path,
        rule: entry.kind,
        message: MESSAGES[entry.kind],
        help: entry.kind === 'stray' ? STRAY_HELP : MOVE_HELP,
        fixable: true,
    }));
}
