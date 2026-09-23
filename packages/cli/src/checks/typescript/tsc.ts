// Selects compiler project mode and confines build metadata to a disposable copy.
import ts from 'typescript';
import { join, relative } from 'node:path';
import { openConfinedRoot } from '#cli/lifecycle/confined.ts';
import { rmSync } from 'node:fs';
import type { CheckResult } from '#cli/output/finding.ts';
import { runToolCheck } from '#cli/run/tool-runner.ts';
import { scratchCopy } from '#cli/run/fixers.ts';
import { targetInScope } from '#cli/run/scope-paths.ts';
import { getTsconfig } from '#cli/repository/tsconfig.ts';
import type { Session, PlannedCheck } from '#cli/run/types.ts';

function validateBuild(root: string, path: string, visited = new Set<string>()): void {
    if (visited.has(path)) return;
    visited.add(path);
    const config = getTsconfig(root, path);
    if (config === undefined) throw new Error(`Missing TypeScript project: ${path}`);
    const files = openConfinedRoot(root, 'native');
    try {
        for (const file of config.fileNames) {
            files.source(relative(root, file).replaceAll('\\', '/'));
            if (config.options.noEmit) continue;
            for (const output of ts.getOutputFileNames(config, file, !ts.sys.useCaseSensitiveFileNames))
                files.stat(relative(root, output).replaceAll('\\', '/'));
        }
        const metadata = ts.getTsBuildInfoEmitOutputFilePath(config.options);
        if (metadata !== undefined) files.stat(relative(root, metadata).replaceAll('\\', '/'));
        for (const reference of config.projectReferences ?? [])
            validateBuild(root, ts.resolveProjectReferencePath(reference), visited);
    } finally {
        files.close();
    }
}

/**
 * Checks ordinary projects and every project named by a solution configuration.
 * @param session the repository session
 * @param planned the compiler check for one scope
 * @returns compiler findings and the shared tool execution status
 */
export async function checkTypescript(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const config = getTsconfig(session.root, join(session.root, planned.scope.scope.path, 'tsconfig.json'));
    const references = (config?.projectReferences?.length ?? 0) > 0;
    const command = references
        ? ['tsc', '-b', '--pretty', 'false']
        : ['tsc', '--noEmit', '-p', '{config:tsconfig}', '--pretty', 'false'];
    const scratch = scratchCopy(
        session.root,
        [
            ...session.repository.files.map((file) => file.path),
            ...(planned.manifest?.configs ?? [])
                .filter((entry) => entry.target === '.gspot/tsconfig.check.json')
                .map((entry) => targetInScope(planned.scope.scope.path, entry)),
        ],
        session.repository.scopes.map((scope) => scope.path),
    );
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
