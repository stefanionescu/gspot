import { join } from 'node:path';
import type ts from 'typescript';
import { remember } from '#cli/system/cache.ts';
import { GSPOT_FOLDER } from '#cli/config/system.ts';
import type { RunCache } from '#cli/types/system.ts';
import { compareText } from '#cli/system/text/order.ts';
import { buildBaseResult } from '#cli/engine/results.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { TypeScriptProject } from '#cli/types/parsers.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/projects.ts';
import { runCommandCheck } from '#cli/engine/run/tool-runs/check.ts';
import type { CheckResult, CheckSession } from '#cli/types/engine/run.ts';
import { writeScopeTsconfig, listEnforcedTsconfigOptions } from '#cli/configurations/tsc/scope-tsconfig.ts';

import {
    TSBUILDINFO_FLAG,
    TSC_BUILD_COMMAND,
    TSC_PROJECT_COMMAND,
    PARENT_TSCONFIG_SKIP,
    TSCONFIG_TSBUILDINFO,
    TSC_UNFORMATTED_OUTPUT,
} from '#cli/config/configurations/shared.ts';

const CHECKED_PROJECTS = Symbol('checked projects');

export function addTsbuildinfoFlag(
    command: string[],
    options: ts.CompilerOptions | undefined,
    folder: string,
    name: string,
): void {
    if (options?.incremental !== true && options?.composite !== true) return;
    command.push(TSBUILDINFO_FLAG, join(folder, GSPOT_FOLDER, name));
}

/**
Shares a project compile across scopes, but never skips a second run in the same scope. The first scope to start wins.

@returns whether this scope owns the project: true when it won the claim, or won it earlier in this run.
*/
export function claimProjectCheck(
    cache: RunCache,
    projectCheck: { check: string; path: string; scopePath: string; required: Record<string, boolean> },
): boolean {
    const { check, path, scopePath, required } = projectCheck;
    const key = JSON.stringify([
        check,
        path,
        Object.entries(required).toSorted(([left], [right]) => compareText(left, right)),
    ]);
    return remember(cache, CHECKED_PROJECTS, key, () => scopePath) === scopePath;
}

export async function runTsc(
    session: CheckSession,
    planned: PlannedCheck,
    tsbuildinfoFolder: string,
    project: TypeScriptProject | undefined,
): Promise<CheckResult> {
    const required = listEnforcedTsconfigOptions(session.settings.level, planned.scope);
    const target = project === undefined ? join(session.root, planned.scope.path, TSCONFIG_FILE) : project.path;
    if (
        !claimProjectCheck(session.cache, {
            check: planned.check.id,
            path: target,
            scopePath: planned.scope.path,
            required,
        })
    )
        return {
            ...buildBaseResult(planned, session),
            status: 'skipped',
            cause: 'replaced',
            note: PARENT_TSCONFIG_SKIP,
        };
    const command: string[] = [];
    if (project !== undefined && (project.config.projectReferences ?? []).length > 0) {
        command.push(...TSC_BUILD_COMMAND, project.path);
    } else {
        command.push(...TSC_PROJECT_COMMAND, writeScopeTsconfig(session, planned.scope, tsbuildinfoFolder));
        addTsbuildinfoFlag(command, project?.config.options, tsbuildinfoFolder, TSCONFIG_TSBUILDINFO);
    }
    command.push(...TSC_UNFORMATTED_OUTPUT);
    return runCommandCheck(session, planned, { command });
}
