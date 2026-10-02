import { join } from 'node:path';
import { statSync } from 'node:fs';
import { findingAt } from '#cli/execution/finding.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { BASELINE } from '#cli/config/checks/general/secrets.ts';
import type { Finding, EngineInput } from '#cli/types/execution/execution.ts';
import type { BaselineReason, GitleaksFinding } from '#cli/types/checks/general/secrets.ts';
/**
 * One finding for each baseline entry with no reason, and one for each whose file is gone.
 * @param input the engine input
 * @returns the findings
 */
export function gitleaksBaseline(input: EngineInput): Finding[] {
    using files = openRoot(input.root);
    const bytes: Buffer | undefined = files.read(BASELINE)?.bytes;
    if (bytes === undefined) return [];
    const entries = JSON.parse(bytes.toString('utf8')) as GitleaksFinding[];
    const reasons = (input.view.tool('gitleaks')['baseline_reasons'] as BaselineReason[] | undefined) ?? [];
    const explained = new Set(reasons.map((entry) => entry.fingerprint));
    return entries.flatMap((entry) => [
        ...(explained.has(entry.Fingerprint)
            ? []
            : [
                  findingAt(
                      input,
                      { file: BASELINE, line: 1 },
                      'missing-reason',
                      `The baseline entry ${entry.Fingerprint} has no reason.`,
                  ),
              ]),
        // An entry with a commit is a finding in history: the file may be gone, and the commit still holds the value.
        ...((entry.Commit ?? '') !== '' ||
        statSync(join(input.root, entry.File), { throwIfNoEntry: false }) !== undefined
            ? []
            : [
                  findingAt(
                      input,
                      { file: BASELINE, line: 1 },
                      'stale-entry',
                      `The baseline entry ${entry.Fingerprint} names ${entry.File}, which is gone.`,
                  ),
              ]),
    ]);
}
