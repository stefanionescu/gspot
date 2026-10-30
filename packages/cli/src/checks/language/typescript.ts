import { join, posix, relative } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/session.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { type CheckFinding } from '#cli/types/runs/check.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/projects/tsconfig.ts';
import { claimProjectCheck } from '#cli/checks/cross-configuration/tsc/compiler.ts';
import { readTsconfig, readTsconfigProject } from '#cli/parsers/projects/tsconfig.ts';
import { selectRequiredTsconfigOptions } from '#cli/checks/cross-configuration/tsc/scope-tsconfig.ts';
import { TYPESCRIPT_TAG, PARENT_TSCONFIG_SKIP } from '#cli/config/checks/cross-configuration/tsc/compiler.ts';

import {
    OPTION_HELP,
    TSCONFIG_NAME,
    STRICT_FAMILY_OPTIONS,
    MISSING_TSCONFIG_RULE,
    MISSING_TSCONFIG_MESSAGE,
} from '#cli/config/checks/language/typescript.ts';

/**
Reports each required compiler option that a scope tsconfig leaves off.

@param session the repository and its tools.
@param planned the scope to check.
*/
export function checkTsconfig(session: Session, planned: PlannedCheck): CheckFinding[] {
    const project = readTsconfigProject(
        session.root,
        planned.scope.path,
        planned.files.filter((file) => file.tags.includes(TYPESCRIPT_TAG)).map((file) => file.path),
        session.cache,
    );
    const scopeTsconfig =
        project === undefined
            ? joinScope(planned.scope.path, TSCONFIG_FILE)
            : convertToPosixPath(relative(session.root, project.path));
    if (project === undefined && planned.files.some((file) => file.tags.includes(TYPESCRIPT_TAG)))
        return [
            {
                file: scopeTsconfig,
                rule: MISSING_TSCONFIG_RULE,
                message: MISSING_TSCONFIG_MESSAGE,
            },
        ];
    const tsconfigPaths = new Set([
        scopeTsconfig,
        ...planned.files.map((file) => file.path).filter((path) => TSCONFIG_NAME.test(posix.basename(path))),
    ]);
    const required = selectRequiredTsconfigOptions(session.settings.level, planned.scope.configurations);
    const projects = [...tsconfigPaths].flatMap((path) => {
        const parsed = readTsconfig(session.root, join(session.root, path), session.cache);
        return parsed === undefined || (parsed.fileNames.length === 0 && (parsed.projectReferences?.length ?? 0) > 0)
            ? []
            : { path, parsed };
    });
    const unchecked = projects.filter(
        ({ path }) =>
            !claimProjectCheck(session.cache, {
                check: planned.check.id,
                path: join(session.root, path),
                scope: planned.scope.path,
                required,
            }),
    );
    if (projects.length > 0 && unchecked.length === 0) throw new GspotError('skip', PARENT_TSCONFIG_SKIP);
    return unchecked.flatMap(({ path, parsed }) =>
        [
            ...Object.keys(required).filter((option) => parsed.options[option] !== true),
            ...(required['strict'] === true
                ? STRICT_FAMILY_OPTIONS.filter((option) => parsed.options[option] === false)
                : []),
        ].map((option) => ({
            file: path,
            rule: option,
            message: `${option} is not on in this tsconfig.`,

            help: OPTION_HELP,
        })),
    );
}
