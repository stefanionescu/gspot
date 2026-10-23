import { join, dirname, relative } from 'node:path';
import type { Session } from '#cli/types/session.ts';
import { listCheckedFiles } from '#cli/planning/files.ts';
import { createCheckCopy } from '#cli/runs/copy/files.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { findScopeFolder } from '#cli/repository/scopes.ts';
import type { CheckResult } from '#cli/types/runs/check.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { readTsconfigProject } from '#cli/parsers/projects/tsconfig.ts';
import { runTsc, listCompilerFiles, restoreCommandPaths, writeReferenceProjects } from '#cli/checks/tsc/compiler.ts';

/**
 * Runs tsc on a project, or on every project that a solution tsconfig names.
 *
 * @param session the repository and its tools.
 * @param planned the compiler check for one scope.
 * @returns the check result.
 */
export async function checkTsc(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const project = readTsconfigProject(
        session.root,
        planned.scope.folder.path,
        listCheckedFiles(session.scopes, planned)
            .filter((file) => file.tags.includes('typescript'))
            .map((file) => file.path),
        session.reads,
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
            reads: session.reads,
            projects: references.projects,
        });
        scratchSession = { ...session, root: scratch.path, reads: createReadCache(scratch.path) };
        scopeProject = { ...references, path: join(scratch.path, relative(session.root, references.path)) };
    }
    const result = restoreCommandPaths(
        await runTsc(scratchSession, planned, scratch.path, scopeProject),
        scratch.path,
        session.root,
    );
    return references === undefined ? result : leaveChildScopeFindings(session, planned, result);
}

function leaveChildScopeFindings(session: Session, planned: PlannedCheck, result: CheckResult): CheckResult {
    const checked = new Set(
        session.configuredChecks
            .filter(({ check }) => check.id === planned.check.id)
            .map(({ scope }) => scope.folder.path),
    );
    const own = planned.scope.folder.path;
    const findings = result.findings.filter(({ file }) => {
        const owner = file === '' ? own : findScopeFolder(file, session.repository.scopeFolders).path;
        return owner === own || !checked.has(owner);
    });
    if (findings.length === result.findings.length) return result;
    return {
        ...result,
        findings,
        status: findings.length === 0 && result.status === 'failed' ? 'passed' : result.status,
    };
}
