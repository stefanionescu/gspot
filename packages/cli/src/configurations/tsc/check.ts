import { dirname, join, relative } from 'node:path';

import { MISSING_MODULE_RULE, QUOTED_MODULE, TYPESCRIPT_TAG } from '#cli/config/configurations/shared.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import { listCompilerFiles, runTsc, writeReferenceProjects } from '#cli/configurations/tsc/compiler.ts';
import { createCheckCopy } from '#cli/engine/copies/files.ts';
import { listCheckedFiles } from '#cli/engine/files.ts';
import { restoreCommandPaths } from '#cli/engine/results.ts';
import { readPackageJson } from '#cli/parsers/projects/dependencies.ts';
import { readTsconfigProject } from '#cli/parsers/projects/tsconfig.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import { listWorkspaceFolders } from '#cli/repository/workspaces.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { createTemporaryFolder } from '#cli/system/files/temporary.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckResult, CheckSession } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

function addUnbuiltPackageNote(session: CheckSession, result: CheckResult): CheckResult {
    const missing = result.findings.flatMap(({ rule, message }) =>
        rule === MISSING_MODULE_RULE ? (QUOTED_MODULE.exec(message)?.groups?.['name'] ?? []) : [],
    );
    if (missing.length === 0) return result;
    const packages = listWorkspaceFolders(session.root).flatMap(
        (folder) => readPackageJson(session.root, join(folder, PACKAGE_JSON))?.name ?? [],
    );
    const name = packages.find((each) => missing.some((module) => module === each || module.startsWith(`${each}/`)));
    return name === undefined
        ? result
        : {
              ...result,
              note: `${name} is a package of this repository, and its types may need a build. Run your build, then check again.`,
          };
}

function removeChildScopeFindings(session: Session, planned: PlannedCheck, result: CheckResult): CheckResult {
    const checked = new Set(
        session.configuredChecks.filter(({ check }) => check.id === planned.check.id).map(({ scope }) => scope.path),
    );
    const own = planned.scope.path;
    const findings = result.findings.filter(({ file }) => {
        const owner = file === '' ? own : selectScopePath(file, session.repository.scopeFolders);
        return owner === own || !checked.has(owner);
    });
    if (findings.length === result.findings.length) return result;
    return {
        ...result,
        findings,
        status: findings.length === 0 && result.status === 'failed' ? 'passed' : result.status,
    };
}

async function checkTsc(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const project = readTsconfigProject(
        session.root,
        planned.scope.path,
        listCheckedFiles(session.scopes, planned)
            .filter((file) => file.tags.includes(TYPESCRIPT_TAG))
            .map((file) => file.path),
        session.cache,
    );
    const references = (project?.config.projectReferences ?? []).length > 0 ? project : undefined;
    const prerequisites =
        references === undefined
            ? []
            : listCompilerFiles(
                  session,
                  [...references.projects].map(([path, config]) => [
                      convertToPosixPath(relative(session.root, dirname(path))),
                      config,
                  ]),
              );
    using scratch =
        references === undefined ? createTemporaryFolder() : await createCheckCopy(session, planned, prerequisites);
    let scratchSession = session;
    let scopeProject = project;
    if (references !== undefined) {
        writeReferenceProjects({
            root: session.root,
            copyRoot: scratch.path,
            cache: session.cache,
            projects: references.projects,
        });
        scratchSession = { ...session, root: scratch.path, cache: createRunCache(scratch.path) };
        scopeProject = { ...references, path: join(scratch.path, relative(session.root, references.path)) };
    }
    const result = restoreCommandPaths(
        await runTsc(scratchSession, planned, scratch.path, scopeProject),
        scratch.path,
        session.root,
    );
    return addUnbuiltPackageNote(
        session,
        references === undefined ? result : removeChildScopeFindings(session, planned, result),
    );
}

export const TSC_CHECKS: Readonly<Record<string, CheckCode>> = {
    'typescript/tsc': { run: checkTsc },
    'vue/vue-tsc': { run: checkTsc },
};
