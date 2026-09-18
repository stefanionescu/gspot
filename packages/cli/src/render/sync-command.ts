// sync: re-render everything, or check for drift, or lower baselines, or copy project templates.
import { findRoot } from '#cli/repository/tracked.ts';
import { computeDrift } from '#cli/render/drift.ts';
import { syncAll } from '#cli/render/sync.ts';
import { lowerBaselines } from '#cli/run/baselines.ts';
import type { CommandResult } from '#cli/run/check.ts';
import { openSession, everyManifest } from '#cli/run/session.ts';
import { assertPinMatches } from '#cli/run/version-pin.ts';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RunRecord } from '#types/run-record.ts';

export type SyncOptions = {
    cwd: string;
    check: boolean;
    baseline: boolean;
    projectTemplates: boolean;
    binaryPath?: string;
};

/** Runs sync. */
export async function syncCommand(options: SyncOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    assertPinMatches(root);
    const session = await openSession(root);
    if (options.check) {
        const drift = await computeDrift(session);
        if (drift.length === 0)
            return { text: 'every generated file matches its render\n', json: { drift: [] }, exitCode: 0 };
        const lines = [`${drift.length} generated file${drift.length === 1 ? '' : 's'} drifted:`, ''];
        for (const entry of drift) {
            lines.push(`  ${entry.path}  ${entry.kind}`);
            if (entry.diff)
                lines.push(
                    entry.diff
                        .split('\n')
                        .map((line) => `    ${line}`)
                        .join('\n'),
                );
        }
        lines.push(
            '',
            'Two ways forward: move the change into gspot.toml (gspot set, allow, ignore), or run gspot sync to discard it.',
        );
        return { text: `${lines.join('\n')}\n`, json: { drift }, exitCode: 1 };
    }
    if (options.baseline) {
        const last = join(root, '.gspot', 'last.json');
        if (!existsSync(last))
            return {
                text: 'There is no last run to read. Run gspot check first.\n',
                json: { error: 'no-last-run' },
                exitCode: 2,
            };
        const record = JSON.parse(readFileSync(last, 'utf8')) as RunRecord;
        const findings = record.checks.flatMap((check) => check.findings);
        const existing = new Set(
            everyManifest(session)
                .flatMap((manifest) => manifest.checks.map((check) => check.id))
                .concat(session.loaded.policy.checks.map((check) => check.id)),
        );
        const result = lowerBaselines(root, findings, existing);
        const lines = [
            ...result.lowered.map((id) => `lowered  ${id}`),
            ...result.removed.map((id) => `removed  ${id}`),
            ...result.rose.map(
                (id) => `rose     ${id}  (a baseline never rises; fix the findings or add an ignore with a reason)`,
            ),
        ];
        return {
            text: `${lines.length === 0 ? "every baseline is already at the last run's count" : lines.join('\n')}\n`,
            json: result,
            exitCode: result.rose.length > 0 ? 1 : 0,
        };
    }
    const report = await syncAll(session, options.binaryPath);
    const lines = [
        ...report.written.map((path) => `wrote    ${path}`),
        ...report.blocks.map((path) => `block    ${path}`),
        ...report.removed.map((path) => `removed  ${path}`),
    ];
    if (lines.length === 0) lines.push(`everything up to date (${report.unchanged.length} files)`);
    return { text: `${lines.join('\n')}\n`, json: report, exitCode: 0 };
}
