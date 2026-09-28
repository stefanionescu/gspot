import ts from 'typescript';
import { rm } from 'node:fs/promises';
import type { Root } from '#cli/types/platform.ts';
import { join, dirname, relative } from 'node:path';
import { scopeOf } from '#cli/repository/scopes.ts';
import { targetInScope } from '#cli/kits/targets.ts';
import { PRIVATE_FILE } from '#cli/config/platform.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { getTsconfig } from '#cli/repository/tsconfig.ts';
import { runToolCheck } from '#cli/execution/tool/runner.ts';
import type { CheckResult } from '#cli/types/checks/checks.ts';
import { scratchCopy } from '#cli/execution/files/workspace.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { commandConfigurations } from '#cli/execution/command-expansion.ts';
import type { Session, PlannedCheck } from '#cli/types/execution/execution.ts';

// Both source reads and emitted paths must stay inside the disposable project tree.
function validateOutputs(root: string, config: ts.ParsedCommandLine, files: Root): void {
    for (const file of config.fileNames) {
        files.source(relative(root, file).replaceAll('\\', '/'));
        if (config.options.noEmit === true) continue;
        for (const output of ts.getOutputFileNames(config, file, !ts.sys.useCaseSensitiveFileNames))
            files.stat(relative(root, output).replaceAll('\\', '/'));
    }
    const metadata = ts.getTsBuildInfoEmitOutputFilePath(config.options);
    if (metadata !== undefined) files.stat(relative(root, metadata).replaceAll('\\', '/'));
}

// Incremental checks write metadata only inside their disposable copy.
function appendBuildMetadata(
    command: string[],
    config: ts.ParsedCommandLine | undefined,
    scratch: string,
    name: string,
): void {
    if (config?.options.incremental !== true && config?.options.composite !== true) return;
    command.push('--tsBuildInfoFile', join(scratch, '.gspot', name));
}

function validateBuild(root: string, path: string, visited = new Set<string>()): void {
    if (visited.has(path)) return;
    visited.add(path);
    const config = getTsconfig(root, path);
    if (config === undefined) throw new Error(`Missing TypeScript project: ${path}`);
    const files = openRoot(root, 'native');
    try {
        validateOutputs(root, config, files);
        for (const reference of config.projectReferences ?? [])
            validateBuild(root, ts.resolveProjectReferencePath(reference), visited);
    } finally {
        files.close();
    }
}

// Rewrites the disposable copy of the generated JavaScript project to the scope's files, and counts them.
function writeScopeProject(session: Session, scratch: string, scope: string, target: string): number {
    const generatedPath = join(scratch, target);
    const generated = getTsconfig(scratch, generatedPath);
    if (generated === undefined) throw new Error(`Missing JavaScript configuration: ${target}`);
    const scopeFiles = generated.fileNames.filter(
        (path) => scopeOf(relative(scratch, path).replaceAll('\\', '/'), session.repository.scopes).path === scope,
    );
    if (scopeFiles.length === 0) return 0;
    const authored = JSON.parse(readFileSync(generatedPath, 'utf8')) as Record<string, unknown>;
    // Managed configurations are read-only; only the disposable copy is rewritten.
    chmodSync(generatedPath, PRIVATE_FILE);
    writeFileSync(
        generatedPath,
        JSON.stringify({
            ...authored,
            files: scopeFiles.map((path) => relative(dirname(generatedPath), path).replaceAll('\\', '/')),
            include: [],
            exclude: [],
        }),
    );
    return scopeFiles.length;
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
    const scratch = await scratchCopy(
        session.root,
        [...session.repository.files.map((file) => file.path), ...commandConfigurations(session, planned, command)],
        session.repository.scopes.map((scope) => scope.path),
    );
    try {
        if (references) validateBuild(scratch, join(scratch, planned.scope.scope.path, 'tsconfig.json'));
        else appendBuildMetadata(command, config, scratch, 'tsconfig.check.tsbuildinfo');
        const result = await runToolCheck(session, planned, command, scratch);
        if (result.command !== undefined)
            result.command = result.command.map((part) => part.replace(scratch, () => session.root));
        return result;
    } finally {
        await rm(scratch, { recursive: true, force: true });
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
    const jsconfig = planned.manifest?.configs.find((entry) => entry.target === '.gspot/config/jsconfig.json');
    if (jsconfig === undefined) throw new Error('The typescript configuration declares no jsconfig target.');
    const target = targetInScope(scope, jsconfig);
    const scratch = await scratchCopy(
        session.root,
        [...session.repository.files.map((file) => file.path), target],
        session.repository.scopes.map((entry) => entry.path),
    );
    try {
        const directory = join(scratch, scope);
        const config = getTsconfig(scratch, join(directory, 'jsconfig.json'));
        // A push that changes no JavaScript file leaves the project empty, and the compiler refuses an empty project.
        if (writeScopeProject(session, scratch, scope, target) === 0)
            return { check: planned.check, scope, status: 'ok', files: 0, findings: [], duration: 0 };
        const roots = ts.getEffectiveTypeRoots(config?.options ?? {}, { getCurrentDirectory: () => directory });
        const command = ['tsc', '-p', '{config:jsconfig}', '--pretty', 'false'];
        if (roots !== undefined) command.push('--typeRoots', roots.join(','));
        appendBuildMetadata(command, config, scratch, 'jsconfig.check.tsbuildinfo');
        const result = await runToolCheck(session, planned, command, scratch);
        if (result.command !== undefined)
            result.command = result.command.map((part) => part.replaceAll(scratch, () => session.root));
        return result;
    } finally {
        await rm(scratch, { recursive: true, force: true });
    }
}
