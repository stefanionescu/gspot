// Does every generated file match its render? Runs sync --check in memory.
import { computeDrift } from '#cli/render/drift.ts';
import type { EngineInput } from '#cli/run/engines.ts';
import type { Finding } from '#types/finding.ts';

/** One finding per generated file that differs from its render, is missing, or is a stray gspot file. */
export async function generatedDrift(input: EngineInput): Promise<Finding[]> {
    const drift = await computeDrift(input.session);
    return drift.map((entry) => ({
        check: input.spec.id,
        file: entry.path,
        rule: entry.kind,
        message:
            entry.kind === 'changed'
                ? 'This generated file differs from what gspot.toml renders.'
                : entry.kind === 'missing'
                  ? 'This generated file is missing.'
                  : 'This file carries the gspot header but nothing in the selection renders it.',
        help:
            entry.kind === 'stray'
                ? 'Delete the file, or add the preset that renders it.'
                : 'Move your change into gspot.toml with gspot set, allow or ignore, or run gspot sync to discard it.',
        fixable: true,
    }));
}
