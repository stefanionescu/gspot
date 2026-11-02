import { formatCount } from '#cli/system/text.ts';
import type { Session } from '#cli/types/tools.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { BASELINE_FILE } from '#cli/config/repository/files.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { GSPOT_RULES } from '#cli/config/configurations/structure.ts';
import type { BaselineRun, CheckRunOptions } from '#cli/types/engine/run.ts';

/**
Reports each baseline count that no finding used. The engine runs this check after the others. A count stays unjudged
where no finished check read its file, so a partial run reports only what it read. A count of a deleted file, or of a
check outside the settings, stays stale in every run.

@param session the repository and the configured checks.
@param _planned the configured check.
@param options the state of the baseline in this run.
*/
export function checkBaseline(session: Session, _planned: PlannedCheck, options: CheckRunOptions = {}): CheckFinding[] {
    const { unused, finished, paths } = options.baselineRun as BaselineRun;
    const tracked = new Set(session.repository.files.map(({ path }) => path));
    const configured = new Set(session.configuredChecks.map(({ check }) => check.id));
    const read = new Set(
        finished.flatMap(({ check, files }) =>
            ['', ...files.map(({ path }) => path)].map((path) => `${check.id}\0${path}`),
        ),
    );
    const stale = [...unused.values()].flat().filter(({ file, check, count }) => {
        const isGone = !configured.has(check) || (file !== '' && !tracked.has(file));
        const isRead = read.has(`${check}\0${file}`) && paths?.includes(file) !== false;
        return count > 0 && (isGone || isRead);
    });
    return stale.map(({ file, check, rule, count }) => ({
        file,
        rule: GSPOT_RULES.staleBaseline,
        message: `${BASELINE_FILE} counts ${formatCount(count, 'finding')} of ${[...new Set([check, rule])].join(' ')} that the run did not find.`,
    }));
}
