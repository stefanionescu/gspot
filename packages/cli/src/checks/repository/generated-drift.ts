// Does every generated file match its render? Runs apply --check in memory.
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { computeDrift } from '#cli/emit/drift.ts';

const MESSAGES: Record<string, string> = {
    changed: 'This generated file differs from what gspot.toml renders.',
    missing: 'This generated file is missing.',
    stray: 'This file carries the gspot header but nothing in the selection renders it.',
};
const MOVE_HELP = 'Move your change into gspot.toml with gspot set, allow or ignore, or run gspot apply to discard it.';
const STRAY_HELP = 'Delete the file, or add the preset that renders it.';

/**
 * One finding per generated file that differs from its render, is missing, or is a stray gspot file.
 * @param input the engine input
 * @returns the findings
 */
export function generatedDrift(input: EngineInput): Promise<Finding[]> {
    const findings = computeDrift(input.session).map((entry) => ({
        check: input.spec.name,
        file: entry.path,
        rule: entry.kind,
        message: MESSAGES[entry.kind] ?? MESSAGES['changed'] ?? '',
        help: entry.kind === 'stray' ? STRAY_HELP : MOVE_HELP,
        fixable: true,
    }));
    return Promise.resolve(findings);
}
