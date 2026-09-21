// Selects compiler project mode and confines build metadata to a disposable copy.
import ts from 'typescript';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { lstatSync, realpathSync, rmSync } from 'node:fs';
import type { CheckResult } from '#types/finding.ts';
import { runToolCheck } from '#cli/run/tool-runner.ts';
import { scratchCopy } from '#cli/run/scratch-copy.ts';
import { targetInScope } from '#cli/run/scope-paths.ts';
import { getTsconfig } from '#cli/repository/tsconfig.ts';
import type { Session, PlannedCheck } from '#types/run.ts';

function assertProjectPath(root: string, path: string): void {
    const local = relative(root, path);
    if (local === '..' || local.startsWith(`..${sep}`) || isAbsolute(local))
        throw new Error(`TypeScript path points outside the disposable project: ${path}`);
    let existing = path;
    while (lstatSync(existing, { throwIfNoEntry: false }) === undefined) existing = dirname(existing);
    const canonical = relative(root, realpathSync(existing));
    if (canonical === '..' || canonical.startsWith(`..${sep}`) || isAbsolute(canonical))
        throw new Error(`TypeScript path follows a symbolic link outside the disposable project: ${path}`);
}

function validateBuild(root: string, path: string, visited = new Set<string>()): void {
    assertProjectPath(root, path);
    if (visited.has(path)) return;
    visited.add(path);
    const config = getTsconfig(path);
    if (config === undefined) throw new Error(`Missing TypeScript project: ${path}`);
    for (const file of config.fileNames) {
        assertProjectPath(root, file);
        if (config.options.noEmit) continue;
        for (const output of ts.getOutputFileNames(config, file, !ts.sys.useCaseSensitiveFileNames))
            assertProjectPath(root, output);
    }
    const metadata = ts.getTsBuildInfoEmitOutputFilePath(config.options);
    if (metadata !== undefined) assertProjectPath(root, metadata);
    for (const reference of config.projectReferences ?? [])
        validateBuild(root, ts.resolveProjectReferencePath(reference), visited);
}

/**
 * Checks ordinary projects and every project named by a solution configuration.
 * @param session the repository session
 * @param planned the compiler check for one scope
 * @returns compiler findings and the shared tool execution status
 */
export async function checkTypescript(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const config = getTsconfig(join(session.root, planned.scope.scope.path, 'tsconfig.json'));
    const references = (config?.projectReferences?.length ?? 0) > 0;
    const command = references
        ? ['tsc', '-b', '--pretty', 'false']
        : ['tsc', '--noEmit', '-p', '{config:tsconfig}', '--pretty', 'false'];
    const scratch = scratchCopy(session, [
        ...session.repository.files.map((file) => file.path),
        ...(planned.manifest?.configs ?? [])
            .filter((entry) => entry.target === '.gspot/tsconfig.check.json')
            .map((entry) => targetInScope(planned.scope.scope.path, entry)),
    ]);
    try {
        if (references) validateBuild(scratch, join(scratch, planned.scope.scope.path, 'tsconfig.json'));
        else if (config?.options.incremental || config?.options.composite)
            command.push('--tsBuildInfoFile', join(scratch, '.gspot', 'tsconfig.check.tsbuildinfo'));
        const result = await runToolCheck({ ...session, root: scratch }, planned, command);
        if (result.command !== undefined)
            result.command = result.command.map((part) => part.replace(scratch, () => session.root));
        return result;
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}
