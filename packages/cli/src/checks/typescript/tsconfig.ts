import { join, posix, relative } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/tsconfig.ts';
import { TSCONFIG_NAME } from '#cli/config/checks/typescript.ts';
import { TYPESCRIPT_TAG } from '#cli/config/repository/inventory.ts';
import { isProjectChecked } from '#cli/checks/typescript/compiler.ts';
import { readTsconfig, readTsconfigProject } from '#cli/parsers/tsconfig.ts';
import { selectRequiredTsconfigOptions } from '#cli/checks/typescript/scope-tsconfig.ts';

/**
 * Reports each required compiler option that a scope tsconfig leaves off.
 *
 * @param session the repository and its tools.
 * @param planned the scope to check.
 * @returns the findings.
 */
export function checkTypescriptTsconfig(session: Session, planned: PlannedCheck): Finding[] {
    const project = readTsconfigProject(
        session.root,
        planned.scope.folder.path,
        planned.files.filter((file) => file.tags.includes(TYPESCRIPT_TAG)).map((file) => file.path),
        session.reads,
    );
    const scopeTsconfig =
        project === undefined
            ? joinScope(planned.scope.folder.path, TSCONFIG_FILE)
            : convertToPosixPath(relative(session.root, project.path));
    const tsconfigPaths = new Set([
        scopeTsconfig,
        ...planned.files.map((file) => file.path).filter((path) => TSCONFIG_NAME.test(posix.basename(path))),
    ]);
    const required = selectRequiredTsconfigOptions(session.settingsFile.settings.level, planned.scope.configurations);
    const projects = [...tsconfigPaths].flatMap((path) => {
        const parsed = readTsconfig(session.root, join(session.root, path), session.reads);
        return parsed === undefined ? [] : [{ path, parsed }];
    });
    const unchecked = projects.filter(
        ({ path }) =>
            !isProjectChecked(session.reads, {
                check: planned.check.id,
                path: join(session.root, path),
                scope: planned.scope.folder.path,
                required,
            }),
    );
    if (projects.length > 0 && unchecked.length === 0)
        throw new GspotError('skip', 'The tsconfig of a parent folder covers this project, and gspot checks it there.');
    return unchecked.flatMap(({ path, parsed }) =>
        Object.keys(required)
            .filter((option) => parsed.options[option] !== true)
            .map((option) =>
                buildFinding(planned, { file: path }, option, `${option} is not on in this tsconfig.`, {
                    help: 'Turn this compiler option on in this tsconfig.',
                }),
            ),
    );
}
