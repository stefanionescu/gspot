import { join, posix } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { type Session } from '#cli/types/session.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { DOT_GSPOT } from '#cli/config/gspot-folder.ts';
import { listChildScopes } from '#cli/planning/files.ts';
import { buildUvRunCommand } from '#cli/tools/python.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { findCachedText } from '#cli/system/files/reads.ts';
import { type CheckResult } from '#cli/types/runs/check.ts';
import { runCheckCommand } from '#cli/runs/command/check.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/document.ts';
import { deptrySchema } from '#cli/schemas/checks/language/python/deptry.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers/projects/dependencies.ts';

import {
    DEPTRY_COMMAND,
    DEPTRY_EXCLUDE_FLAG,
    DEPTRY_FIRST_PARTY_FLAG,
} from '#cli/config/checks/language/python/deptry.ts';

// The modules of python.externals count as first party, beside the project's own known_first_party list, which the
// command-line flag replaces.
function listFirstParty(planned: PlannedCheck, written: string[]): string[] {
    const externals = planned.scope.settings.values.python?.externals ?? [];
    if (externals.length === 0) return [];
    return [...new Set([...written, ...externals])].flatMap((module) => [DEPTRY_FIRST_PARTY_FLAG, module]);
}

/**
 * Runs deptry on the scope. Passes the project's extend_exclude list again with .gspot and child scopes added, because the command-line flag replaces it.
 *
 * @param session the repository and installed tools.
 * @param planned the dependency check and its scope.
 * @returns the check result.
 */
export async function checkPythonDeptry(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const text = findCachedText(session.reads, joinScope(planned.scope.folder.path, PYPROJECT_TOML));
    if (text === undefined) throw new GspotError('skip', 'This scope has no pyproject.toml for deptry to read.');
    const { extend_exclude: exclusions, known_first_party: firstParty } = parseTomlFile(
        joinScope(planned.scope.folder.path, PYPROJECT_TOML),
        text,
        deptrySchema,
    ).tool.deptry;
    return await runCheckCommand(session, planned, {
        command: buildUvRunCommand(planned.scope, join(session.root, planned.scope.folder.path), [
            ...DEPTRY_COMMAND,
            ...[
                String.raw`(^|.*[/\\])${RegExp.escape(DOT_GSPOT)}([/\\]|$)`,
                ...listChildScopes(session.scopes, planned.scope).map((path) => {
                    const child = posix
                        .relative(planned.scope.folder.path, path)
                        .split('/')
                        .map((part) => RegExp.escape(part))
                        .join(String.raw`[/\\]`);
                    return String.raw`^${child}([/\\]|$)`;
                }),
                ...exclusions,
            ].flatMap((pattern) => [DEPTRY_EXCLUDE_FLAG, pattern]),
            ...listFirstParty(planned, firstParty),
        ]),
    });
}
