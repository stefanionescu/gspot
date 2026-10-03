import ts from 'typescript';
import { toPosix } from '#cli/platform/paths.ts';
import { join, dirname, relative } from 'node:path';
import { scopeOf } from '#cli/repository/scopes.ts';
import { targetInScope } from '#cli/kits/targets.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import type { Session } from '#cli/types/tools/tools.ts';
import { getTsconfig } from '#cli/repository/tsconfig.ts';
import type { Root } from '#cli/types/platform/platform.ts';
import { PRIVATE_FILE } from '#cli/config/platform/root.ts';
import { runToolCheck } from '#cli/execution/tool/runner.ts';
import { scratchCopy } from '#cli/execution/tool/workspace.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { commandConfigurations } from '#cli/execution/tool/placeholders.ts';
import type { CheckResult, PlannedCheck } from '#cli/types/execution/execution.ts';
import { DOT_GSPOT, CONFIGURATION_DIRECTORY } from '#cli/config/platform/locations.ts';

// Both source reads and emitted paths must stay inside the disposable project tree.
function validateOutputs(root: string, config: ts.ParsedCommandLine, files: Root): void {
    for (const file of config.fileNames) {
        files.source(toPosix(relative(root, file)));
        if (config.options.noEmit === true) continue;
        for (const output of ts.getOutputFileNames(config, file, !ts.sys.useCaseSensitiveFileNames))
            files.stat(toPosix(relative(root, output)));
    }
    const metadata = ts.getTsBuildInfoEmitOutputFilePath(config.options);
    if (metadata !== undefined) files.stat(toPosix(relative(root, metadata)));
}

// Incremental checks write metadata only inside their disposable copy.
function appendBuildMetadata(
    command: string[],
    config: ts.ParsedCommandLine | undefined,
    scratch: string,
    name: string,
): void {
    if (config?.options.incremental !== true && config?.options.composite !== true) return;
    command.push('--tsBuildInfoFile', join(scratch, DOT_GSPOT, name));
}

function validateBuild(root: string, path: string, visited = new Set<string>()): void {
    if (visited.has(path)) return;
    visited.add(path);
    const config = getTsconfig(root, path);
    if (config === undefined) throw new Error(`Missing TypeScript project: ${path}`);
    using files = openRoot(root, 'native');
    validateOutputs(root, config, files);
    for (const reference of config.projectReferences ?? [])
        validateBuild(root, ts.resolveProjectReferencePath(reference), visited);
}

// Rewrites the disposable copy of the generated JavaScript project to the scope's files, and counts them.
function writeScopeProject(session: Session, scratch: string, scope: string, target: string): number {
    const generatedPath = join(scratch, target);
    const generated = getTsconfig(scratch, generatedPath);
    if (generated === undefined) throw new Error(`Missing JavaScript configuration: ${target}`);
    const scopeFiles = generated.fileNames.filter(
        (path) => scopeOf(toPosix(relative(scratch, path)), session.repository.scopes).path === scope,
    );
    if (scopeFiles.length === 0) return 0;
    const authored = JSON.parse(readFileSync(generatedPath, 'utf8')) as Record<string, unknown>;
    // Managed configurations are read-only; only the disposable copy is rewritten.
    chmodSync(generatedPath, PRIVATE_FILE);
    writeFileSync(
        generatedPath,
        JSON.stringify({
            ...authored,
            files: scopeFiles.map((path) => toPosix(relative(dirname(generatedPath), path))),
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
export async function tsc(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const config = getTsconfig(session.root, join(session.root, planned.scope.scope.path, 'tsconfig.json'));
    const references = (config?.projectReferences?.length ?? 0) > 0;
    const command = references
        ? ['tsc', '-b', '--pretty', 'false']
        : ['tsc', '--noEmit', '-p', '{config:tsconfig}', '--pretty', 'false'];
    using scratchFolder = await scratchCopy(
        session.root,
        [...session.repository.files.map((file) => file.path), ...commandConfigurations(session, planned, command)],
        session.repository.scopes.map((scope) => scope.path),
    );
    const scratch = scratchFolder.path;
    if (references) validateBuild(scratch, join(scratch, planned.scope.scope.path, 'tsconfig.json'));
    else appendBuildMetadata(command, config, scratch, 'tsconfig.tsbuildinfo');
    const result = await runToolCheck(session, planned, command, scratch);
    if (result.command !== undefined)
        result.command = result.command.map((part) => part.replace(scratch, () => session.root));
    return result;
}

/**
 * Check JavaScript with the repository's ambient types instead of the private tool installation.
 * @param session the selected repository and tool reads
 * @param planned the JavaScript compiler check
 * @returns compiler diagnostics with source paths and supervised execution status
 */
export async function checkjs(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const scope = planned.scope.scope.path;
    const jsconfig = planned.manifest?.configs.find(
        (entry) => entry.target === `${CONFIGURATION_DIRECTORY}/jsconfig.json`,
    );
    if (jsconfig === undefined) throw new Error('The typescript configuration declares no jsconfig target.');
    const target = targetInScope(scope, jsconfig);
    using scratchFolder = await scratchCopy(
        session.root,
        [...session.repository.files.map((file) => file.path), target],
        session.repository.scopes.map((entry) => entry.path),
    );
    const scratch = scratchFolder.path;
    const directory = join(scratch, scope);
    const config = getTsconfig(scratch, join(directory, 'jsconfig.json'));
    // A push that changes no JavaScript file leaves the project empty, and the compiler refuses an empty project.
    if (writeScopeProject(session, scratch, scope, target) === 0)
        return { check: planned.check, scope, status: 'passed', fileCount: 0, findings: [], duration: 0 };
    const roots = ts.getEffectiveTypeRoots(config?.options ?? {}, { getCurrentDirectory: () => directory });
    const command = ['tsc', '-p', '{config:jsconfig}', '--pretty', 'false'];
    if (roots !== undefined) command.push('--typeRoots', roots.join(','));
    appendBuildMetadata(command, config, scratch, 'jsconfig.check.tsbuildinfo');
    const result = await runToolCheck(session, planned, command, scratch);
    if (result.command !== undefined)
        result.command = result.command.map((part) => part.replaceAll(scratch, () => session.root));
    return result;
}
