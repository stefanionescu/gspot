// apply --lower-baselines: the counts of the last run become the baselines, for the checks that run read in full.
import { join } from 'node:path';
import { planRun } from '#cli/run/plan.ts';
import type { RunRecord } from '#types/record.ts';
import { existsSync, readFileSync } from 'node:fs';
import { everyManifest } from '#cli/run/session.ts';
import { lowerBaselines } from '#cli/run/baselines.ts';
import type { Session, CommandResult } from '#types/run.ts';
import { pruneToolBaselines } from '#cli/emit/prune-baselines.ts';

const RAN = new Set(['ok', 'fail']);
// A check the rules or the platform skip never runs here, so its absence from a run says nothing.
const NEVER_RUNS = new Set(['rules', 'platform']);

function refusal(text: string, error: string): CommandResult {
    return { text: `${text}\n`, json: { error }, exitCode: 2 };
}

// The checks the last run read in full: each one ran in every scope the plan holds it in.
// A run of one check, of one scope, or with a check skipped leaves the other counts unknown, and an unknown count is no zero.
function completeChecks(session: Session, record: RunRecord): Set<string> {
    const ran = new Set(
        record.checks.filter((check) => RAN.has(check.status)).map((check) => `${check.check}\n${check.scope}`),
    );
    const planned = planRun(session, { stage: 'all', skips: [], localSkips: [] }).filter(
        (check) => check.skip === undefined || !NEVER_RUNS.has(check.skip.source),
    );
    const missed = new Set(
        planned.filter((check) => !ran.has(`${check.check}\n${check.scope.scope.path}`)).map((check) => check.check),
    );
    return new Set(planned.map((check) => check.check).filter((id) => !missed.has(id)));
}

/**
 * Lowers the baselines to the counts of the last run. A baseline whose check that run did not read in full is left alone.
 * @param root the repository root
 * @param session the session
 * @returns what was lowered, removed, left alone, and refused because a count rose
 */
export async function lowerFromLastRun(root: string, session: Session): Promise<CommandResult> {
    const last = join(root, '.gspot', 'last.json');
    if (!existsSync(last)) return refusal('There is no last run to read. Run gspot check first.', 'no-last-run');
    const record = JSON.parse(readFileSync(last, 'utf8')) as RunRecord;
    if (record.narrowed)
        return refusal(
            'The last run read only the staged or changed files, so its counts are partial. Run gspot check first.',
            'narrowed-last-run',
        );
    const existing = new Set([
        ...everyManifest(session).flatMap((manifest) => manifest.checks.map((check) => check.name)),
        ...session.policyFiles.policy.checks.map((check) => check.name),
    ]);
    const result = lowerBaselines(root, record.baselines, existing, completeChecks(session, record));
    const pruned = await pruneToolBaselines(session);
    const lines = [
        ...pruned.map((id) => `pruned   ${id}  (the tool's own suppressions file)`),
        ...result.lowered.map((id) => `lowered  ${id}`),
        ...result.removed.map((id) => `removed  ${id}`),
        ...result.kept.map((id) => `kept     ${id}  (the last run did not read this check in full)`),
        ...result.rose.map(
            (id) => `rose     ${id}  (a baseline never rises; fix the findings or add an ignore with a reason)`,
        ),
    ];
    const text = lines.length === 0 ? "every baseline is already at the last run's count" : lines.join('\n');
    return { text: `${text}\n`, json: { ...result, pruned }, exitCode: result.rose.length > 0 ? 1 : 0 };
}
