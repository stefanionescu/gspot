import { join, posix, relative } from 'node:path';
import type { Session } from '#cli/types/tools.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { CheckStop, GspotError } from '#cli/system/errors.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/projects.ts';
import { claimProjectCheck } from '#cli/configurations/tsc/compiler.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { TsconfigProject } from '#cli/types/configurations/language.ts';
import { readTsconfig, readTsconfigProject } from '#cli/parsers/projects/tsconfig.ts';
import { selectRequiredTsconfigOptions } from '#cli/configurations/tsc/scope-tsconfig.ts';
import { TYPESCRIPT_TAG, PARENT_TSCONFIG_SKIP } from '#cli/config/configurations/shared.ts';
import { TSCONFIG_EXPLANATIONS } from '#cli/configurations/language/typescript/explanations.ts';

import {
    OPTION_HELP,
    TSCONFIG_NAME,
    MISSING_TSCONFIG_HELP,
    MISSING_TSCONFIG_RULE,
    STRICT_FAMILY_OPTIONS,
    MISSING_TSCONFIG_MESSAGE,
    UNREADABLE_TSCONFIG_HELP,
    UNREADABLE_TSCONFIG_RULE,
} from '#cli/config/configurations/typescript.ts';

function listTsconfigPaths(planned: PlannedCheck, scopeTsconfig: string): string[] {
    return [
        ...new Set([
            scopeTsconfig,
            ...planned.files.map((file) => file.path).filter((path) => TSCONFIG_NAME.test(posix.basename(path))),
        ]),
    ];
}

function listUnreadableTsconfigs(session: Session, planned: PlannedCheck): CheckFinding[] {
    return listTsconfigPaths(planned, joinScope(planned.scope.path, TSCONFIG_FILE)).flatMap((path) => {
        try {
            readTsconfig(session.root, join(session.root, path), session.cache);
            return [];
        } catch (error) {
            if (!(error instanceof GspotError) || error.code !== 'configuration') throw error;
            return [
                {
                    file: path,
                    line: 1,
                    rule: UNREADABLE_TSCONFIG_RULE,
                    message: error.message,
                    help: UNREADABLE_TSCONFIG_HELP,
                },
            ];
        }
    });
}

function claimOwnedProjects(
    session: Session,
    planned: PlannedCheck,
    { projects, required }: { projects: TsconfigProject[]; required: Record<string, boolean> },
): TsconfigProject[] {
    const owned: TsconfigProject[] = [];
    for (const project of projects) {
        const isOwned = claimProjectCheck(session.cache, {
            check: planned.check.id,
            path: join(session.root, project.path),
            scopePath: planned.scope.path,
            required,
        });
        if (isOwned) owned.push(project);
    }
    if (projects.length > 0 && owned.length === 0)
        throw new CheckStop('skipped', PARENT_TSCONFIG_SKIP, { skipCause: 'replaced' });
    return owned;
}

/**
Reports each required compiler option that a scope tsconfig leaves off. A tsconfig that fails to load reports alone,
because the other checks treat it as absent.
*/
function checkTsconfig(session: Session, planned: PlannedCheck): CheckFinding[] {
    const unreadable = listUnreadableTsconfigs(session, planned);
    if (unreadable.length > 0) return unreadable;
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
                help: MISSING_TSCONFIG_HELP,
            },
        ];
    const required = selectRequiredTsconfigOptions(session.settings.level, planned.scope.configurations);
    const projects = listTsconfigPaths(planned, scopeTsconfig).flatMap((path) => {
        const parsed = readTsconfig(session.root, join(session.root, path), session.cache);
        return parsed === undefined || (parsed.fileNames.length === 0 && (parsed.projectReferences?.length ?? 0) > 0)
            ? []
            : { path, parsed };
    });
    const owned = claimOwnedProjects(session, planned, { projects, required });
    return owned.flatMap(({ path, parsed }) =>
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

export const TYPESCRIPT_CHECKS: Readonly<Record<string, CheckCode>> = {
    'typescript/tsconfig': { check: checkTsconfig, explanations: TSCONFIG_EXPLANATIONS },
};
