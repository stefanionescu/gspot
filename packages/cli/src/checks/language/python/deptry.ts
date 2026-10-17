import { z } from 'zod';
import { join, posix } from 'node:path';
import { parse } from '@decimalturn/toml-patch';
import { GspotError } from '#cli/system/errors.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { listChildScopes } from '#cli/planning/files.ts';
import { DOT_GSPOT } from '#cli/config/system/locations.ts';
import { buildUvRunCommand } from '#cli/tools/python/project.ts';
import { type CheckResult } from '#cli/types/checks/run/check.ts';
import { runCheckCommand } from '#cli/checks/run/command/check.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers/dependency-files.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { DEPTRY_COMMAND, DEPTRY_EXCLUDE_FLAG } from '#cli/config/checks/language/python.ts';

const deptrySchema = z.object({
    tool: z
        .object({
            deptry: z
                .object({ extend_exclude: z.array(z.string()).default([]) } satisfies SchemaShape<
                    NonNullable<NonNullable<{ tool: { deptry: { extend_exclude: string[] } } }['tool']>['deptry']>
                >)
                .default({ extend_exclude: [] }),
        } satisfies SchemaShape<NonNullable<{ tool: { deptry: { extend_exclude: string[] } } }['tool']>>)
        .default({ deptry: { extend_exclude: [] } }),
} satisfies SchemaShape<{ tool: { deptry: { extend_exclude: string[] } } }>);

/**
 * Runs deptry on the scope. Passes the project's extend_exclude list again with .gspot and child scopes added, because the command-line flag replaces it.
 * @param session the repository and installed tools.
 * @param planned the dependency check and its scope.
 * @returns the check result.
 */
export async function checkDeptry(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const text = readText(session.root, posix.join(planned.scope.scope.path, PYPROJECT_TOML));
    if (text === undefined) throw new GspotError('skip', 'This scope has no pyproject.toml for deptry to read.');
    const exclusions: string[] = deptrySchema.parse(parse(text)).tool.deptry.extend_exclude;
    return await runCheckCommand(session, planned, {
        command: buildUvRunCommand(planned.scope, join(session.root, planned.scope.scope.path), [
            ...DEPTRY_COMMAND,
            ...[
                String.raw`(^|.*[/\\])${RegExp.escape(DOT_GSPOT)}([/\\]|$)`,
                ...listChildScopes(session, planned.scope).map((path) => {
                    const child = posix
                        .relative(planned.scope.scope.path, path)
                        .split('/')
                        .map((part) => RegExp.escape(part))
                        .join(String.raw`[/\\]`);
                    return String.raw`^${child}([/\\]|$)`;
                }),
                ...exclusions,
            ].flatMap((pattern) => [DEPTRY_EXCLUDE_FLAG, pattern]),
        ]),
    });
}
