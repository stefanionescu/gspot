import { join, posix } from 'node:path';
import { find } from '#cli/system/files/reads.ts';
import { compareText } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { listEnclosingFolders } from '#cli/system/paths.ts';
import { type CheckFinding } from '#cli/types/runs/check.ts';
import type { Session, CheckSession } from '#cli/types/session.ts';
import { planSwiftBuild } from '#cli/checks/language/swift/cache.ts';
import { getConfigFilePath } from '#cli/runs/command/placeholders.ts';
import { buildConfigFiles } from '#cli/generation/config-files/generate.ts';
import { getConfigFileTarget } from '#cli/generation/config-files/selection.ts';
import { runSwiftBuild, runCopiedTool } from '#cli/checks/language/swift/build.ts';

import {
    ANALYZER_RULE,
    SWIFTLINT_TOOL,
    COMPILER_LOG_FLAG,
    SWIFTLINT_CONFIG_FILE,
    SWIFTLINT_CONFIG_FLAG,
    SWIFTLINT_ANALYZE_COMMAND,
} from '#cli/config/checks/language/swift.ts';

/**
Runs the SwiftLint analyzer rules over the compiler log of the build.

@param session the repository and its tools.
@param planned the scope to analyze.
*/
export async function checkSwiftlintAnalyze(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const plan = planSwiftBuild(session, planned, 'analyze');
    const build = await runSwiftBuild(session, planned, plan);
    if (build.code !== 0)
        throw new GspotError('check', `Cannot analyze Swift because the build exited ${String(build.code)}.`);
    const configFile = join(session.root, getConfigFilePath(session, planned, SWIFTLINT_TOOL));
    const commandArguments = [
        ...SWIFTLINT_ANALYZE_COMMAND,
        SWIFTLINT_CONFIG_FLAG,
        configFile,
        COMPILER_LOG_FLAG,
        plan.log,
    ];
    return runCopiedTool(session, planned, {
        source: build.source,
        commandArguments,
        defaultRule: ANALYZER_RULE,
        tool: 'swiftlint',
    });
}

/**
Lists the SwiftLint files a copy keeps: the scope link file, the config file, and SwiftLint files in parent folders.

@param session the repository and its tools.
@param planned the scope files and config files.
@returns the repository-relative paths, sorted.
*/
export function listSwiftlintConfigFiles(session: Session, planned: PlannedCheck): string[] {
    const paths = [
        joinScope(planned.scope.path, SWIFTLINT_CONFIG_FILE),
        ...session.configurationsByName
            .values()
            .flatMap((configuration) => configuration.configFiles)
            .filter((configFile) => configFile.pointer?.path === SWIFTLINT_CONFIG_FILE)
            .map((configFile) => getConfigFileTarget(planned.scope.path, configFile, buildConfigFiles(session))),
    ];
    for (const file of planned.files) {
        const folders = listEnclosingFolders(posix.dirname(file.path));
        const parents = folders.slice(0, folders.indexOf(planned.scope.path));
        for (const folder of parents) {
            const path = posix.join(folder, SWIFTLINT_CONFIG_FILE);
            if (find(session.cache, path) !== undefined) paths.push(path);
        }
    }
    return [...new Set(paths)].toSorted((a, b) => compareText(a, b));
}
