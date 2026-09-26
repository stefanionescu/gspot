import { join } from 'node:path';
import { statSync } from 'node:fs';
import { BASELINE } from '#cli/constants/checks/security.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { EngineInput, Finding } from '#cli/types/checks/checks.ts';
import type { BaselineReason, GitleaksFinding } from '#cli/types/checks/security.ts';

function finding(input: EngineInput, rule: string, text: string): Finding {
    return { check: input.spec.name, file: BASELINE, line: 1, rule, message: text, fixable: false };
}

/**
 * One finding for each baseline entry with no reason, and one for each whose file is gone.
 * @param input the engine input
 * @returns the findings
 */
export function gitleaksBaseline(input: EngineInput): Finding[] {
    const files = openConfinedRoot(input.root);
    let bytes: Buffer | undefined;
    try {
        bytes = files.read(BASELINE)?.bytes;
    } finally {
        files.close();
    }
    if (bytes === undefined) return [];
    const entries = JSON.parse(bytes.toString('utf8')) as GitleaksFinding[];
    const reasons = (input.view.tool('gitleaks')['baseline_reasons'] as BaselineReason[] | undefined) ?? [];
    const explained = new Set(reasons.map((entry) => entry.fingerprint));
    return entries.flatMap((entry) => [
        ...(explained.has(entry.Fingerprint)
            ? []
            : [finding(input, 'no-reason', `The baseline entry ${entry.Fingerprint} has no reason.`)]),
        // An entry with a commit is a finding in history: the file may be gone, and the commit still holds the value.
        ...((entry.Commit ?? '') !== '' ||
        statSync(join(input.root, entry.File), { throwIfNoEntry: false }) !== undefined
            ? []
            : [
                  finding(
                      input,
                      'stale-entry',
                      `The baseline entry ${entry.Fingerprint} names ${entry.File}, which is gone.`,
                  ),
              ]),
    ]);
}
