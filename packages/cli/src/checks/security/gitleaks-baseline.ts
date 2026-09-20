// Every reviewed finding in the gitleaks baseline carries a reason and names a path that still exists.
import { join } from 'node:path';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { existsSync, readFileSync } from 'node:fs';
import type { BaselineReason, GitleaksFinding } from '#types/integrity.ts';

const BASELINE = '.gspot/gitleaks-baseline.json';

function finding(input: EngineInput, rule: string, text: string): Finding {
    return { check: input.spec.name, file: BASELINE, line: 1, rule, message: text, fixable: false };
}

/**
 * One finding for each baseline entry with no reason, and one for each whose file is gone.
 * @param input the engine input
 * @returns the findings
 */
export function gitleaksBaseline(input: EngineInput): Promise<Finding[]> {
    const path = join(input.root, BASELINE);
    if (!existsSync(path)) return Promise.resolve([]);
    const entries = JSON.parse(readFileSync(path, 'utf8')) as GitleaksFinding[];
    const reasons = (input.view.tool('gitleaks')['baseline_reasons'] as BaselineReason[] | undefined) ?? [];
    const explained = new Set(reasons.map((entry) => entry.fingerprint));
    const findings = entries.flatMap((entry) => [
        ...(explained.has(entry.Fingerprint)
            ? []
            : [finding(input, 'no-reason', `The baseline entry ${entry.Fingerprint} has no reason.`)]),
        // An entry with a commit is a finding in history: the file may be gone, and the commit still holds the value.
        ...((entry.Commit ?? '') !== '' || existsSync(join(input.root, entry.File))
            ? []
            : [
                  finding(
                      input,
                      'stale-entry',
                      `The baseline entry ${entry.Fingerprint} names ${entry.File}, which is gone.`,
                  ),
              ]),
    ]);
    return Promise.resolve(findings);
}
