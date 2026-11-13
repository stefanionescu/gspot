import { NESTED_AGENTS_MESSAGE, NESTED_AGENTS_RULE } from '#cli/config/configurations/general.ts';
import { AGENTS_FILE } from '#cli/config/parsers/formats.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

function checkNestedAgentsFiles(_session: Session, planned: PlannedCheck): CheckFinding[] {
    return planned.files
        .filter(({ path }) => path !== AGENTS_FILE)
        .map(({ path }) => ({ file: path, line: 1, rule: NESTED_AGENTS_RULE, message: NESTED_AGENTS_MESSAGE }));
}

export const AGENTS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'agents/nested-files': { check: checkNestedAgentsFiles },
};
