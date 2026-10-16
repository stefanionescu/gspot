import ts from 'typescript';
import assert from 'node:assert/strict';
import { findScope } from '#cli/repository/scopes.ts';
import { emptyResult } from '#cli/execution/report.ts';
import { coveredInputs } from '#cli/planning/checks.ts';
import { PRIVATE_FILE } from '#cli/config/system/modes.ts';
import { getCachedValue } from '#cli/system/files/cache.ts';
import { type ReadCache } from '#cli/types/system/files.ts';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { type CheckResult } from '#cli/types/execution/check.ts';
import { runCheckCommand } from '#cli/execution/command/check.ts';
import type { Level, Manifest } from '#cli/types/configurations.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { type TsconfigInput } from '#cli/types/generation/typescript.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { join, dirname, resolve, relative, isAbsolute } from 'node:path';
import { readTsconfig, readTsconfigProject } from '#cli/parsers/tsconfig.ts';
import type { TypeScriptReferenceCopy } from '#cli/types/checks/language.ts';
import type { TypeScriptConfiguration } from '#cli/types/parsers/tsconfig.ts';
import { DOT_GSPOT, TOOL_FILE_DIRECTORY } from '#cli/config/system/locations.ts';
import { isInside, extractExtension, convertToPosixPath } from '#cli/system/paths.ts';

import {
    COMPILER_OPTIONS,
    RECOMMENDED_OPTIONS,
    TYPESCRIPT_DEFAULTS,
    NESTJS_CONFIGURATION,
    NESTJS_COMPILER_OPTIONS,
} from '#cli/config/generation/typescript.ts';
import {
    TSCONFIG_FILE,
    TSC_PLAIN_OUTPUT,
    TSC_BUILD_COMMAND,
    TSC_PROJECT_COMMAND,
    TSCONFIG_TSBUILDINFO,
    TYPESCRIPT_TSCONFIG_CHECK,
} from '#cli/config/parsers/tsconfig.ts';
import {
    TSBUILDINFO_FLAG,
    TSC_REFERENCE_BUNDLE,
    TSC_CONFIG_INPUT_PATHS,
    TSC_PATHS_BASE_REQUIRED,
    TSC_COMPILER_INPUT_PATHS,
    TSC_CONFIGURATION_REQUIRED,
    TSC_REFERENCE_OUTPUT_FOLDER,
} from '#cli/config/checks/language/typescript.ts';

const CHECKED_PROJECTS = { create: () => new Map<string, string>() };

/**
 * Move repository-owned absolute compiler paths into their captured tree.
 * @param value one configured path or an array of paths.
 * @param input the source and scratch roots.
 * @returns the updated paths.
 */
function copiedCompilerPath(value: unknown, input: TypeScriptReferenceCopy): unknown {
    if (Array.isArray(value)) return value.map((path: unknown) => copiedCompilerPath(path, input));
    if (typeof value !== 'string' || !isAbsolute(value) || !isInside(relative(input.root, value))) return value;
    return join(input.scratchRoot, relative(input.root, value));
}

/**
 * Preserve compiler inputs while keeping reference resolution and outputs in the owned tree.
 * @param input the captured configuration and its source and scratch roots.
 * @returns the configuration for the native compiler in the scratch copy.
 */
function referenceTsconfig(
    input: TypeScriptReferenceCopy & { path: string; config: TypeScriptConfiguration },
): Record<string, unknown> {
    const { root, scratchRoot, path, config } = input;
    const output = join(scratchRoot, DOT_GSPOT, TSC_REFERENCE_OUTPUT_FOLDER, relative(root, path));
    const paths =
        config.options.paths === undefined
            ? undefined
            : Object.fromEntries(
                  Object.entries(config.options.paths).map(([name, aliases]) => {
                      const base = config.options.baseUrl ?? config.options['pathsBasePath'];
                      assert.ok(typeof base === 'string', TSC_PATHS_BASE_REQUIRED);
                      return [name, aliases.map((alias) => copiedCompilerPath(resolve(base, alias), input))];
                  }),
              );
    return {
        ...config.raw,
        ...Object.fromEntries(
            TSC_CONFIG_INPUT_PATHS.map((name) => [name, copiedCompilerPath(config.raw[name], input)]),
        ),
        references: config.projectReferences?.map((reference) => ({
            ...reference,
            path: join(scratchRoot, relative(root, ts.resolveProjectReferencePath(reference))),
        })),
        compilerOptions: {
            ...config.raw.compilerOptions,
            ...Object.fromEntries(
                TSC_COMPILER_INPUT_PATHS.map((name) => [name, copiedCompilerPath(config.options[name], input)]),
            ),
            ...(paths === undefined ? {} : { paths }),
            outDir: output,
            ...(config.options.declarationDir === undefined ? {} : { declarationDir: output }),
            ...(config.options.outFile === undefined ? {} : { outFile: join(output, TSC_REFERENCE_BUNDLE) }),
            tsBuildInfoFile: join(output, TSCONFIG_TSBUILDINFO),
        },
    };
}

/**
 * Keep incremental metadata inside the caller's scratch folder.
 * @param command the compiler argv.
 * @param options the resolved options.
 * @param scratch the owned metadata directory.
 * @param name the metadata basename.
 */
export function appendBuildMetadata(
    command: string[],
    options: ts.CompilerOptions | undefined,
    scratch: string,
    name: string,
): void {
    if (options?.incremental !== true && options?.composite !== true) return;
    command.push(TSBUILDINFO_FLAG, join(scratch, DOT_GSPOT, name));
}

/**
 * Restore source paths in a compiler run in a scratch copy.
 * @param result the result, which may have no launched command.
 * @param scratch the scratch copy root.
 * @param root the source root.
 * @returns the result with source command paths.
 */
export function restoreCommandPaths(result: CheckResult, scratch: string, root: string): CheckResult {
    if (result.command === undefined) return result;
    return {
        ...result,
        command: result.command.map((part) => part.replaceAll(scratch, () => root)),
    };
}

/**
 * Share ancestor checks without suppressing another invocation for the same scope.
 * @param reads the run cache.
 * @param check the compiler or option check identity.
 * @param path the project path.
 * @param scope the invoking scope.
 * @param required the compiler flags for one scope.
 * @returns whether another scope already checks this project with these flags.
 */
export function projectChecked(
    reads: ReadCache,
    check: string,
    path: string,
    scope: string,
    required: Record<string, boolean>,
): boolean {
    const checked = getCachedValue(reads, CHECKED_PROJECTS);
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
 * Run the compiler in an already selected project, with metadata in the caller's owned folder.
 * @param session the source or scratch copy session.
 * @param planned the compiler declaration for one scope.
 * @param metadataRoot the caller-owned metadata lifetime.
 * @returns compiler diagnostics and execution status.
 */
export async function runTsc(session: Session, planned: PlannedCheck, metadataRoot: string): Promise<CheckResult> {
    const project = readTsconfigProject(
        session.root,
        planned.scope.scope.path,
        coveredInputs(session, planned)
            .filter((file) => file.tags.includes('typescript'))
            .map((file) => file.path),
        session.reads,
    );
    const required = Object.fromEntries(
        Object.entries(
            selectRequiredTsconfigOptions(session.settingsFile.settings.level, planned.scope.selected),
        ).filter(([name]) => !planned.scope.view.rulesOff(TYPESCRIPT_TSCONFIG_CHECK).includes(name)),
    );
    const target = project === undefined ? join(session.root, planned.scope.scope.path, TSCONFIG_FILE) : project.path;
    if (projectChecked(session.reads, planned.check.name, target, planned.scope.scope.path, required))
        return { ...emptyResult(planned), status: 'skipped', note: 'An ancestor compiler check covers this project.' };
    const command: string[] = [];
    if (project !== undefined && (project.config.projectReferences ?? []).length > 0) {
        command.push(...TSC_BUILD_COMMAND, project.path);
    } else {
        const generatedPath = join(metadataRoot, TOOL_FILE_DIRECTORY, planned.scope.scope.path, TSCONFIG_FILE);
        writeTsconfig({
            root: session.root,
            typeRootsFolder: session.installedRoot,
            reads: session.reads,
            target: convertToPosixPath(relative(session.root, generatedPath)),
            scope: planned.scope.scope.path,
            files: session.repository.files,
            scopeEntries: session.repository.scopes,
            options: required,
        });
        command.push(...TSC_PROJECT_COMMAND, generatedPath);
        appendBuildMetadata(command, project?.config.options, metadataRoot, TSCONFIG_TSBUILDINFO);
    }
    command.push(...TSC_PLAIN_OUTPUT);
    return runCheckCommand(session, planned, { command, scratchRoot: session.root });
}

/**
 * Write the compiler project for a caller-owned runtime folder.
 * @param input the source project and relative runtime target.
 * @returns the absolute runtime configuration path.
 */
export function writeTsconfig(input: TsconfigInput): string {
    const target = join(input.root, input.target);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify(buildTsconfig(input)));
    return target;
}

/**
 * Keep declarations, bundles, and incremental metadata of reference builds in their scratch copy.
 * @param input the captured reference graph and its owned copy.
 * @returns after replacing only the copied compiler configurations.
 */
export function writeReferenceProjects(input: TypeScriptReferenceCopy): void {
    const { root, scratchRoot, projects, reads } = input;
    const configurations = new Map([
        ...projects,
        ...[...projects.values()].flatMap((config) =>
            config.extendedConfigurationFiles.map((path) => {
                const parsed = readTsconfig(root, path, reads);
                assert.ok(parsed !== undefined, TSC_CONFIGURATION_REQUIRED);
                return [path, parsed] as const;
            }),
        ),
    ]);
    for (const [path, config] of configurations) {
        const target = join(scratchRoot, relative(root, path));
        chmodSync(target, PRIVATE_FILE);
        writeFileSync(target, JSON.stringify(referenceTsconfig({ ...input, path, config })));
    }
}

/**
 * Preserve authored projects and supply a standalone source project when the scope has none.
 *
 * @param input the scope's source inventory, generated target, and required options.
 *
 * @returns the compiler configuration.
 */
export function buildTsconfig(input: TsconfigInput): Record<string, unknown> {
    const { root, typeRootsFolder, reads, target, scope, files, scopeEntries, options } = input;
    const authored = readTsconfigProject(
        root,
        scope,
        files
            .filter(
                (file) =>
                    (file.tags.includes('typescript') || DECLARATION_EXTENSIONS.has(extractExtension(file.path))) &&
                    findScope(file.path, scopeEntries).path === scope,
            )
            .map((file) => file.path),
        reads,
    );
    const projectRoots =
        ts.getEffectiveTypeRoots(
            {},
            {
                getCurrentDirectory: () =>
                    join(typeRootsFolder, authored === undefined ? scope : relative(root, dirname(authored.path))),
            },
        ) ?? [];
    const folder = dirname(resolve(root, target));
    const typeRoots = projectRoots.map((path) => convertToPosixPath(relative(folder, path)));
    if (authored !== undefined)
        return {
            extends: convertToPosixPath(relative(folder, authored.path)),
            files: authored.config.fileNames.map((path) => convertToPosixPath(relative(folder, path))),
            compilerOptions: {
                ...(authored.config.options.typeRoots === undefined ? { typeRoots } : {}),
            },
        };
    const sources = files.filter(
        (file) =>
            file.kind === 'source' &&
            (file.tags.includes('typescript') || DECLARATION_EXTENSIONS.has(extractExtension(file.path))) &&
            findScope(file.path, scopeEntries).path === scope,
    );
    // Svelte reads these extra extensions through include; tsc ignores them as unsupported sources.
    const components = files.filter(
        (file) =>
            file.kind === 'source' && file.tags.includes('svelte') && findScope(file.path, scopeEntries).path === scope,
    );
    return {
        compilerOptions: {
            ...TYPESCRIPT_DEFAULTS,
            ...options,
            typeRoots,
        },
        files: sources.map((file) => convertToPosixPath(relative(folder, join(root, file.path)))),
        ...(components.length === 0
            ? {}
            : { include: components.map((file) => convertToPosixPath(relative(folder, join(root, file.path)))) }),
    };
}

/**
 * Required compiler diagnostics and framework settings for generation and authored option auditing.
 *
 * @param level the selected check level.
 * @param selected the applicable configuration manifests.
 *
 * @returns the required compiler options.
 */
export function selectRequiredTsconfigOptions(level: Level, selected: Manifest[]): Record<string, boolean> {
    const options: Record<string, boolean> = { ...(level === 'all' ? COMPILER_OPTIONS : RECOMMENDED_OPTIONS) };
    if (selected.some((manifest) => manifest.configuration.name === NESTJS_CONFIGURATION))
        Object.assign(options, NESTJS_COMPILER_OPTIONS);
    return options;
}
