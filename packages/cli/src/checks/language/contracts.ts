import ts from 'typescript';
import { memo } from '#cli/platform/memo.ts';
import { join, dirname, relative } from 'node:path';
import { ownedInputs } from '#cli/planning/public.ts';
import { emptyResult } from '#cli/execution/report.ts';
import type { Root } from '#cli/types/platform/root.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { PRIVATE_FILE } from '#cli/config/platform/modes.ts';
import { scopeOf } from '#cli/repository/paths/contracts.ts';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import { parseBashScript } from '#cli/parsers/bash/public.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { SCRIPT_TAG } from '#cli/config/checks/language/bash.ts';
import type { ScriptFunction } from '#cli/types/parsers/bash.ts';
import type { ScratchSource } from '#cli/types/execution/copy.ts';
import { runCheckCommand } from '#cli/execution/command/public.ts';
import { isToolProjectPath } from '#cli/repository/paths/public.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/platform/runtime.ts';
import type { CheckInput, CheckResult } from '#cli/types/execution/check.ts';
import type { TypeScriptConfiguration } from '#cli/types/parsers/packages.ts';
import { toPosix, expandPaths, extensionOf } from '#cli/platform/contracts.ts';
import type { ScriptFile, ScriptIndex } from '#cli/types/checks/language/bash.ts';
import { buildTsconfig, requiredTsconfigOptions } from '#cli/generation/tsconfig.ts';
import { openRoot, readSource, createReadCache } from '#cli/platform/root/public.ts';
import { projectCopyInputs, workspaceSourceFiles } from '#cli/execution/copy/public.ts';
import { getTsconfig, projectSources, tsconfigProjects, getTsconfigProject } from '#cli/parsers/packages/public.ts';

const TYPESCRIPT_CHECKS = { create: () => new Map<string, string>() };

const SCRIPT_MEMO = { create: () => new Map<string, Promise<ScriptIndex>>() };

async function readScript(input: CheckInput, file: TrackedFile): Promise<ScriptFile> {
    const text = readSource(input.root, file.path, input.reads).toString('utf8');
    const syntax = await parseBashScript(text, {
        minimumStatements: input.view.limit('min_function_statements', 'bash'),
        context: input,
    });
    const references = new Map<string, number[]>();
    for (const call of syntax.calls) {
        const found = references.get(call.name) ?? [];
        found.push(call.line);
        references.set(call.name, found);
    }
    return {
        ...syntax,
        path: file.path,
        text,
        lines: text.split('\n'),
        isExecutable: file.executable,
        references,
    };
}

async function readScriptIndex(input: CheckInput, files: TrackedFile[]): Promise<ScriptIndex> {
    const read: ScriptFile[] = [];
    for (const file of files) read.push(await readScript(input, file));
    const owners = new Map<string, string>();
    for (const file of read)
        for (const entry of file.functions) if (!owners.has(entry.name)) owners.set(entry.name, file.path);
    return { files: read, owners };
}

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

function assertBuildInside(root: string, path: string, reads: ReadCache): void {
    using files = openRoot(root, 'native');
    for (const config of tsconfigProjects(root, path, reads).values()) assertOutputsInside(root, config, files);
}

/**
 * Read the scope's shell index once, sharing syntax data across its checks.
 * @param input the check's scope-owned files and parser resources
 * @returns the index
 */
export function getScriptIndex(input: CheckInput): Promise<ScriptIndex> {
    const files = input.files.filter(
        (file) => file.kind === 'source' && file.tags.includes(SCRIPT_TAG) && !isToolProjectPath(file.path),
    );
    const perScope = memo(input.reads, SCRIPT_MEMO);
    const key = JSON.stringify([input.scope, files.map((file) => file.path)]);
    let index = perScope.get(key);
    if (index === undefined) {
        index = readScriptIndex(input, files);
        perScope.set(key, index);
    }
    return index;
}

/**
 * Find the innermost function that contains a source line.
 * @param functions the parsed functions
 * @param line the one-based line
 * @returns the function, or undefined at the top level
 */
export function functionAt(functions: ScriptFunction[], line: number): ScriptFunction | undefined {
    return functions
        .filter((entry) => entry.start <= line && line <= entry.end)
        .toSorted((left, right) => left.end - left.start - (right.end - right.start))[0];
}

/**
 * Select the scope's compiler inputs and physical ambient roots.
 * @param root the actual source or disposable repository
 * @param scope the owning scope
 * @param scopes the repository's scope declarations
 * @param config the native compiler configuration
 * @returns the scope-owned compiler project
 */
export function scopeCompilerProject(
    root: string,
    scope: string,
    scopes: ToolSession['repository']['scopes'],
    config: TypeScriptConfiguration,
): Pick<TypeScriptConfiguration, 'fileNames' | 'options'> {
    return {
        fileNames: config.fileNames.filter(
            (path) =>
                DECLARATION_EXTENSIONS.includes(extensionOf(path)) ||
                scopeOf(toPosix(relative(root, path)), scopes).path === scope,
        ),
        options: {
            ...config.options,
            typeRoots:
                ts.getEffectiveTypeRoots(
                    { ...config.options, configFilePath: join(root, scope, 'jsconfig.json') },
                    {},
                ) ?? [],
        },
    };
}

/**
 * Restrict a disposable JavaScript project to its scope and ambient roots.
 * @param session the repository source inventory
 * @param scratch the disposable copy
 * @param planned the scoped compiler check
 * @param target the generated project path
 * @returns effective options, or undefined for an empty project
 */
export function writeScopeProject(
    session: ToolSession,
    scratch: string,
    planned: PlannedCheck,
    target: string,
): ts.CompilerOptions | undefined {
    if (ownedInputs(session, planned).length === 0) return undefined;
    const generatedPath = join(scratch, target);
    const generated = getTsconfig(scratch, generatedPath, createReadCache(scratch));
    if (generated === undefined) throw new Error(`Missing JavaScript tool file: ${target}`);
    const project = scopeCompilerProject(scratch, planned.scope.scope.path, session.repository.scopes, generated);
    if (project.fileNames.length === 0) return undefined;
    // Rewrite the tool file only in the disposable copy.
    chmodSync(generatedPath, PRIVATE_FILE);
    writeFileSync(
        generatedPath,
        JSON.stringify({
            ...generated.raw,
            compilerOptions: {
                ...generated.raw.compilerOptions,
                typeRoots: project.options.typeRoots,
            },
            files: project.fileNames.map((path) => toPosix(relative(dirname(generatedPath), path))),
            include: [],
            exclude: [],
        }),
    );
    return generated.options;
}

/**
 * Keep incremental metadata inside the caller's disposable folder.
 * @param command the compiler argv
 * @param options the effective native options
 * @param scratch the owned metadata directory
 * @param name the metadata basename
 */
export function appendBuildMetadata(
    command: string[],
    options: ts.CompilerOptions | undefined,
    scratch: string,
    name: string,
): void {
    if (options?.incremental !== true && options?.composite !== true) return;
    command.push('--tsBuildInfoFile', join(scratch, DOT_GSPOT, name));
}

/**
 * Restore source paths in a disposable compiler invocation.
 * @param result the native result, which may have no launched command
 * @param scratch the disposable root
 * @param root the authored source root
 * @returns the result with source command paths
 */
export function restoreCommandPaths(result: CheckResult, scratch: string, root: string): CheckResult {
    if (result.command === undefined) return result;
    return {
        ...result,
        command: result.command.map((part) => part.replaceAll(scratch, () => root)),
    };
}

/**
 * Select compiler-resolved authored dependencies and only their owning installed projects.
 * @param session the repository boundary and cached native configurations
 * @param planned the actual scoped compiler check
 * @param projects the project graph with scope-owned JavaScript roots.
 * @returns the native authored source and configuration closure
 */
export function compilerFiles(
    session: ToolSession,
    planned: PlannedCheck,
    projects: Map<string, TypeScriptConfiguration>,
): string[] {
    const workspace = new Set(
        workspaceSourceFiles(session.root, planned.scope.scope.path, session.repository.files, session.reads),
    );
    using files = openRoot(session.root, 'native');
    const sources = [...projects].flatMap(([target, config]) => {
        const owners = new Set(
            config.fileNames.map(
                (path) => scopeOf(toPosix(relative(session.root, path)), session.repository.scopes).path,
            ),
        );
        const inputs = projectSources(session.root, planned.scope.scope.path, session.reads, config).map((source) => {
            const local = toPosix(relative(session.root, source.fileName));
            files.assertInside(local);
            if (
                !source.isDeclarationFile &&
                !owners.has(scopeOf(local, session.repository.scopes).path) &&
                !workspace.has(local)
            )
                throw new Error(`TypeScript project ${target} imports source outside its scope: ${local}`);
            return local;
        });
        const configurations = config.configurationFiles
            .map((path) => toPosix(relative(session.root, path)))
            .filter((path) => !path.split('/').includes('node_modules'));
        return [...configurations, ...inputs];
    });
    return [...new Set([...planned.files.map((file) => file.path), ...sources])];
}

/**
 * Copy selected compiler inputs with their physical ancestor dependency installations.
 * @param session the repository and cancellation lifetime
 * @param planned the scoped compiler declaration
 * @param projects the actual native project graph
 * @param paths the resolved authored compiler inputs
 * @returns the copy inputs with confined installed dependency ownership
 */
export function compilerCopyInputs(
    session: ToolSession,
    planned: PlannedCheck,
    projects: Map<string, TypeScriptConfiguration>,
    paths: string[],
): ScratchSource {
    const scopes = expandPaths(
        [...projects.keys()].map((target) => {
            const folder = toPosix(relative(session.root, dirname(target)));
            return folder.startsWith(`${DOT_GSPOT}/`) ? planned.scope.scope.path : folder;
        }),
    );
    return {
        ...projectCopyInputs(session.root, paths, [...new Set(['', planned.scope.scope.path, ...scopes])]),
        cancelSignal: session.cancelSignal,
    };
}

/**
 * Share ancestor checks without suppressing a repeat of the same scoped invocation.
 * @param reads the native run cache
 * @param check the compiler or option check identity
 * @param path the native project path
 * @param scope the invoking scope
 * @param required the scoped compiler flags.
 * @returns whether another scope already checks this project with these flags
 */
export function projectChecked(
    reads: ReadCache,
    check: string,
    path: string,
    scope: string,
    required: Record<string, boolean>,
): boolean {
    const checked = memo(reads, TYPESCRIPT_CHECKS);
    const key = JSON.stringify([
        check,
        path,
        Object.entries(required).toSorted(([left], [right]) => left.localeCompare(right)),
    ]);
    const earlier = checked.get(key);
    if (earlier !== undefined && earlier !== scope) return true;
    checked.set(key, scope);
    return false;
}

/**
 * Run the native compiler in an already selected project, with metadata in the caller's owned folder.
 * @param session the actual source or disposable project session
 * @param planned the scoped native compiler declaration
 * @param metadataRoot the caller-owned metadata lifetime
 * @returns native compiler diagnostics and execution status
 */
export async function runTsc(session: ToolSession, planned: PlannedCheck, metadataRoot: string): Promise<CheckResult> {
    const project = getTsconfigProject(
        session.root,
        planned.scope.scope.path,
        ownedInputs(session, planned)
            .filter((file) => file.tags.includes('typescript'))
            .map((file) => file.path),
        session.reads,
    );
    const required = Object.fromEntries(
        Object.entries(requiredTsconfigOptions(session.policyFiles.policy.level, planned.scope.selected)).filter(
            ([name]) => !planned.scope.view.rulesOff('typescript/tsconfig').includes(name),
        ),
    );
    const target = project === undefined ? join(session.root, planned.scope.scope.path, 'tsconfig.json') : project.path;
    if (projectChecked(session.reads, planned.check.name, target, planned.scope.scope.path, required))
        return { ...emptyResult(planned), status: 'skipped', note: 'An ancestor compiler check covers this project.' };
    const command = ['tsc'];
    if (project !== undefined && (project.config.projectReferences ?? []).length > 0) {
        command.push('-b', project.path);
        assertBuildInside(session.root, project.path, session.reads);
    } else {
        const generatedPath = join(metadataRoot, '.gspot/config', planned.scope.scope.path, 'tsconfig.json');
        mkdirSync(dirname(generatedPath), { recursive: true });
        writeFileSync(
            generatedPath,
            JSON.stringify(
                buildTsconfig({
                    root: session.root,
                    installedRoot: session.installedRoot ?? session.root,
                    reads: session.reads,
                    target: toPosix(relative(session.root, generatedPath)),
                    scope: planned.scope.scope.path,
                    files: session.repository.files,
                    scopeEntries: session.repository.scopes,
                    options: required,
                }),
            ),
        );
        command.push('--noEmit', '-p', generatedPath);
        appendBuildMetadata(command, project?.config.options, metadataRoot, 'tsconfig.tsbuildinfo');
    }
    command.push('--pretty', 'false');
    return runCheckCommand(session, planned, { command, workspace: session.root });
}
