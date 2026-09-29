import { join } from 'node:path';
import { statSync } from 'node:fs';
import { openRoot } from '#cli/platform/filesystem.ts';
import { BASELINE } from '#cli/config/checks/security.ts';
import type { Finding, EngineInput, BaselineReason, GitleaksFinding } from '#cli/types/checks.ts';
/**
 * One finding for each baseline entry with no reason, and one for each whose file is gone.
 * @param input the engine input
 * @returns the findings
 */
export function gitleaksBaseline(input: EngineInput): Finding[] {
    const files = openRoot(input.root);
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
            : [
                  {
                      check: input.spec.name,
                      file: BASELINE,
                      line: 1,
                      rule: 'no-reason',
                      message: `The baseline entry ${entry.Fingerprint} has no reason.`,
                      fixable: false,
                  },
              ]),
        // An entry with a commit is a finding in history: the file may be gone, and the commit still holds the value.
        ...((entry.Commit ?? '') !== '' ||
        statSync(join(input.root, entry.File), { throwIfNoEntry: false }) !== undefined
            ? []
            : [
                  {
                      check: input.spec.name,
                      file: BASELINE,
                      line: 1,
                      rule: 'stale-entry',
                      message: `The baseline entry ${entry.Fingerprint} names ${entry.File}, which is gone.`,
                      fixable: false,
                  },
              ]),
    ]);
}
