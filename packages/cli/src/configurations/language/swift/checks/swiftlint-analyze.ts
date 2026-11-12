import { join } from 'node:path';

import {
    ANALYZER_RULE,
    COMPILER_LOG_FLAG,
    SWIFTLINT_ANALYZE_COMMAND,
    SWIFTLINT_TOOL,
} from '#cli/config/configurations/swift.ts';
import { CONFIG_FLAG } from '#cli/config/tools/installers.ts';
import { runCopiedTool, runSwiftBuild } from '#cli/configurations/language/swift/checks/build.ts';
import { planSwiftBuild } from '#cli/configurations/language/swift/checks/cache.ts';
import { getConfigPath } from '#cli/engine/tool-runs/placeholders.ts';
import { CheckStop } from '#cli/system/errors.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { type CheckCode, type CheckFinding, type CheckSession } from '#cli/types/engine/run.ts';

async function checkSwiftlintAnalyze(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const plan = planSwiftBuild(session, planned);
    const build = await runSwiftBuild(session, planned, plan, { clean: true });
    if (build.code !== 0)
        throw new CheckStop('error', `Cannot analyze Swift because the build exited ${String(build.code)}.`);
    const config = join(session.root, getConfigPath(session, planned, SWIFTLINT_TOOL));
    const commandArguments = [...SWIFTLINT_ANALYZE_COMMAND, CONFIG_FLAG, config, COMPILER_LOG_FLAG, plan.log];
    return runCopiedTool(session, planned, {
        source: build.source,
        commandArguments,
        defaultRule: ANALYZER_RULE,
        tool: 'swiftlint',
    });
}

export const SWIFT_SWIFTLINT_ANALYZE_CHECKS: Readonly<Record<string, CheckCode>> = {
    'swift/swiftlint-analyze': { check: checkSwiftlintAnalyze },
};
