import ts from 'typescript';
import { findingAt } from '#cli/checks/finding.ts';
import { ownedInputs } from '#cli/planning/plan.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { getTsconfig } from '#cli/parsers/tsconfig.ts';
import { parseJsonRecord } from '#cli/parsers/json.ts';
import type { Root } from '#cli/types/platform/root.ts';
import { scratchFolder } from '#cli/platform/scratch.ts';
import { createReadCache } from '#cli/platform/source.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { join, posix, dirname, relative } from 'node:path';
import type { Finding } from '#cli/types/parsers/output.ts';
import { PRIVATE_FILE } from '#cli/config/platform/modes.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import { toPosix, extensionOf } from '#cli/platform/paths.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { runCheckCommand } from '#cli/execution/command/check.ts';
import { targetInScope } from '#cli/configurations/declarations.ts';
import { requiredTsconfigOptions } from '#cli/generation/tsconfig.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/platform/runtime.ts';
import type { CheckInput, CheckResult } from '#cli/types/execution/check.ts';
import { copyIntoScratch, projectCopyInputs } from '#cli/execution/copy/files.ts';
import { DOT_GSPOT, CONFIGURATION_DIRECTORY } from '#cli/config/platform/locations.ts';

// Both source reads and emitted paths must stay inside the disposable project tree.
function assertOutputsInside(root: string, config: ts.ParsedCommandLine, files: Root): void {
    for (const file of config.fileNames) {
        files.assertInside(toPosix(relative(root, file)));
        if (config.options.noEmit === true) continue;
        for (const output of ts.getOutputFileNames(config, file, !ts.sys.useCaseSensitiveFileNames))
            files.stat(toPosix(relative(root, output)));
    }
    const metadata = ts.getTsBuildInfoEmitOutputFilePath(config.options);
    if (metadata !== undefined) files.stat(toPosix(relative(root, metadata)));
}

// Incremental checks write metadata only inside their disposable folder.
function appendBuildMetadata(
    command: string[],
    options: ts.CompilerOptions | undefined,
    scratch: string,
    name: string,
): void {
    if (options?.incremental !== true && options?.composite !== true) return;
    command.push('--tsBuildInfoFile', join(scratch, DOT_GSPOT, name));
}

function assertBuildInside(root: string, path: string, reads: ReadCache, visited = new Set<string>()): void {
    if (visited.has(path)) return;
    visited.add(path);
    const config = getTsconfig(root, path, reads);
    if (config === undefined) throw new Error(`Missing TypeScript project: ${path}`);
    using files = openRoot(root, 'native');
    assertOutputsInside(root, config, files);
    for (const reference of config.projectReferences ?? [])
        assertBuildInside(root, ts.resolveProjectReferencePath(reference), reads, visited);
}

// Restrict the disposable JavaScript project to its scope and ambient roots, and retain its effective options.
function writeScopeProject(
    session: ToolSession,
    scratch: string,
    planned: PlannedCheck,
    target: string,
): ts.CompilerOptions | undefined {
    if (ownedInputs(session, planned).length === 0) return undefined;
    const scope = planned.scope.scope.path;
    const generatedPath = join(scratch, target);
    const generated = getTsconfig(scratch, generatedPath, { root: scratch, sources: new Map(), memo: new Map() });
    if (generated === undefined) throw new Error(`Missing JavaScript configuration: ${target}`);
    const scopeFiles = generated.fileNames.filter(
        (path) =>
            DECLARATION_EXTENSIONS.includes(extensionOf(path)) ||
            scopeOf(toPosix(relative(scratch, path)), session.repository.scopes).path === scope,
    );
    if (scopeFiles.length === 0) return undefined;
    const authored = parseJsonRecord(readFileSync(generatedPath, 'utf8'));
    // Managed configurations are read-only; only the disposable copy is rewritten.
    chmodSync(generatedPath, PRIVATE_FILE);
    writeFileSync(
        generatedPath,
        JSON.stringify({
            ...authored,
            compilerOptions: {
                ...(authored['compilerOptions'] as Record<string, unknown>),
                typeRoots:
                    ts.getEffectiveTypeRoots(
                        { ...generated.options, configFilePath: join(scratch, scope, 'jsconfig.json') },
                        {},
                    ) ?? [],
            },
            files: scopeFiles.map((path) => toPosix(relative(dirname(generatedPath), path))),
            include: [],
            exclude: [],
        }),
    );
    return generated.options;
}

// Restore every scratch path in the recorded invocation while retaining a result with no launched command.
function restoreCommandPaths(result: CheckResult, scratch: string, root: string): CheckResult {
    if (result.command === undefined) return result;
    return { ...result, command: result.command.map((part) => part.replaceAll(scratch, () => root)) };
}

/**
 * Checks ordinary projects and every project named by a solution configuration.
 * @param session the repository session
 * @param planned the compiler check for one scope
 * @returns compiler findings and the shared tool execution status
 */
export async function tsc(session: ToolSession, planned: PlannedCheck): Promise<CheckResult> {
    const target = join(planned.scope.scope.path, 'tsconfig.json');
    const config = getTsconfig(session.root, join(session.root, target), session.reads);
    const hasReferences = (config?.projectReferences ?? []).length > 0;
    const command = [
        'tsc',
        ...(hasReferences ? ['-b'] : ['--noEmit', '-p', '{tool_file:tsconfig}']),
        '--pretty',
        'false',
    ];
    using source = hasReferences
        ? await copyIntoScratch(
              projectCopyInputs(
                  session.root,
                  session.repository.files.map((file) => file.path),
                  session.repository.scopes.map((scope) => scope.path),
              ),
          )
        : scratchFolder('gspot-tsc-');
    const scratch = source.path;
    if (hasReferences) assertBuildInside(scratch, join(scratch, target), createReadCache(scratch));
    else appendBuildMetadata(command, config?.options, scratch, 'tsconfig.tsbuildinfo');
    const result = await runCheckCommand(session, planned, {
        command,
        workspace: hasReferences ? scratch : session.root,
    });
    return restoreCommandPaths(result, scratch, session.root);
}

/**
 * Check JavaScript with the repository's ambient types instead of the tool project installation.
 * @param session the selected repository and tool reads
 * @param planned the JavaScript compiler check
 * @returns compiler diagnostics with source paths and the command status
 */
export async function checkjs(session: ToolSession, planned: PlannedCheck): Promise<CheckResult> {
    const scope = planned.scope.scope.path;
    const jsconfig = planned.manifest?.toolFiles.find(
        (entry) => entry.target === `${CONFIGURATION_DIRECTORY}/jsconfig.json`,
    );
    if (jsconfig === undefined)
        throw new Error(`The javascript configuration declares no ${CONFIGURATION_DIRECTORY}/jsconfig.json target.`);
    const target = targetInScope(scope, jsconfig);
    using scratchFolder = await copyIntoScratch(
        projectCopyInputs(
            session.root,
            [...session.repository.files.map((file) => file.path), target],
            session.repository.scopes.map((entry) => entry.path),
        ),
    );
    const scratch = scratchFolder.path;
    const options = writeScopeProject(session, scratch, planned, target);
    // A push that changes no JavaScript file leaves the project empty, and the compiler refuses an empty project.
    if (options === undefined)
        return { check: planned.check.name, scope, status: 'passed', fileCount: 0, findings: [], duration: 0 };
    const command = ['tsc', '-p', '{tool_file:jsconfig}', '--pretty', 'false'];
    appendBuildMetadata(command, options, scratch, 'jsconfig.check.tsbuildinfo');
    const result = await runCheckCommand(session, planned, { command: command, workspace: scratch });
    return restoreCommandPaths(result, scratch, session.root);
}

/**
 * One finding per required option a scope's tsconfig leaves off.
 * @param input the check input for the scope
 * @returns the findings
 */
export function tsconfig(input: CheckInput): Finding[] {
    const scopeTsconfig = input.scope === '' ? 'tsconfig.json' : `${input.scope}/tsconfig.json`;
    const candidates = new Set([
        scopeTsconfig,
        ...input.files
            .map((file) => file.path)
            .filter((path) => {
                const name = posix.basename(path);
                return name.startsWith('tsconfig.') && name.endsWith('.json');
            }),
    ]);
    const required = requiredTsconfigOptions(input.policyFiles.policy.level, input.selection.selected);
    return [...candidates].flatMap((path) => {
        const parsed = getTsconfig(input.root, join(input.root, path), input.reads);
        if (parsed !== undefined)
            return Object.keys(required)
                .filter((option) => parsed.options[option] !== true)
                .map((option) => ({
                    ...findingAt(input, { file: path }, option, `${option} is not on in this tsconfig.`),
                    help: 'Enable this compiler option in the authored TypeScript configuration.',
                }));
        return [];
    });
}
