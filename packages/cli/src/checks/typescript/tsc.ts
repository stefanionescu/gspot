// Selects compiler project mode and confines build metadata to a disposable copy.
import ts from 'typescript';
import { scopeOf } from '#cli/repository/scopes.ts';
import { rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { scratchCopy } from '#cli/run/fixers.ts';
import { runToolCheck } from '#cli/run/tool-runner.ts';
import { targetInScope } from '#cli/run/scope-paths.ts';
import type { CheckResult } from '#cli/types/reports.ts';
import { getTsconfig } from '#cli/repository/tsconfig.ts';
import { openConfinedRoot } from '#cli/filesystem/confined.ts';
import type { Session, PlannedCheck } from '#cli/types/execution.ts';

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
                .filter((entry) => entry.target === '.gspot/config/tsconfig.check.json')
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

/**
 * Check JavaScript with the repository's ambient types instead of the private tool installation.
 * @param session the selected repository and tool observations
 * @param planned the JavaScript compiler check
 * @returns compiler diagnostics with source paths and supervised execution status
 */
export async function checkJavascript(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const scope = planned.scope.scope.path;
    const target = targetInScope(scope, planned.manifest!.configs.find((entry) => entry.target === '.gspot/config/jsconfig.json')!);
    const scratch = scratchCopy(session.root, [
        ...session.repository.files.map((file) => file.path), target,
    ], session.repository.scopes.map((entry) => entry.path));
    try {
        const directory = join(scratch, scope);
        const config = getTsconfig(scratch, join(directory, 'jsconfig.json'));
        const generatedPath = join(scratch, target);
        const generated = getTsconfig(scratch, generatedPath);
        if (generated === undefined) throw new Error(`Missing JavaScript configuration: ${target}`);
        const scopedFiles = generated.fileNames.filter((path) =>
            scopeOf(relative(scratch, path).replaceAll('\\', '/'), session.repository.scopes).path === scope);
        const authored = JSON.parse(readFileSync(generatedPath, 'utf8')) as Record<string, unknown>;
        writeFileSync(generatedPath, JSON.stringify({ ...authored,
            files: scopedFiles.map((path) => relative(dirname(generatedPath), path).replaceAll('\\', '/')),
            include: [], exclude: [],
        }));
        const roots = ts.getEffectiveTypeRoots(config?.options ?? {}, { getCurrentDirectory: () => directory });
        const command = ['tsc', '-p', '{config:jsconfig}', '--pretty', 'false'];
        if (roots !== undefined) command.push('--typeRoots', roots.join(','));
        if (config?.options.incremental || config?.options.composite)
            command.push('--tsBuildInfoFile', join(scratch, '.gspot', 'jsconfig.check.tsbuildinfo'));
        const result = await runToolCheck({ ...session, root: scratch }, planned, command);
        if (result.command !== undefined)
            result.command = result.command.map((part) => part.replaceAll(scratch, () => session.root));
        return result;
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}
