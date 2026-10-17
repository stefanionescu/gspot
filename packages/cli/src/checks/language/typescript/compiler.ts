import ts from 'typescript';
import assert from 'node:assert/strict';
import { findScope } from '#cli/repository/scopes.ts';
import { PRIVATE_FILE } from '#cli/config/system/modes.ts';
import { buildBaseResult } from '#cli/checks/run/report.ts';
import { getCachedValue } from '#cli/system/files/cache.ts';
import { type ReadCache } from '#cli/types/system/files.ts';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { type CheckResult } from '#cli/types/checks/run/check.ts';
import { runCheckCommand } from '#cli/checks/run/command/check.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { type Level, type Manifest } from '#cli/types/configurations.ts';
import { type TsconfigInput } from '#cli/types/generation/typescript.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { join, dirname, resolve, relative, isAbsolute } from 'node:path';
import { readTsconfig, readTsconfigProject } from '#cli/parsers/tsconfig.ts';
import type { TypeScriptReferenceCopy } from '#cli/types/checks/language.ts';
import { DOT_GSPOT, TOOL_FILES_FOLDER } from '#cli/config/system/locations.ts';
import { isInside, extractExtension, convertToPosixPath } from '#cli/system/paths.ts';
import type { TypeScriptProject, TypeScriptConfiguration } from '#cli/types/parsers/tsconfig.ts';

import {
    TSCONFIG_FILE,
    TSC_PLAIN_OUTPUT,
    TSC_BUILD_COMMAND,
    TSC_PROJECT_COMMAND,
    TSCONFIG_TSBUILDINFO,
} from '#cli/config/parsers/tsconfig.ts';
import {
    COMPILER_OPTIONS,
    RECOMMENDED_OPTIONS,
    TYPESCRIPT_DEFAULTS,
    NESTJS_CONFIGURATION,
    NESTJS_COMPILER_OPTIONS,
} from '#cli/config/generation/typescript.ts';
import {
    TSBUILDINFO_FLAG,
    TSC_REFERENCE_BUNDLE,
    TSC_CONFIG_INPUT_PATHS,
    TSC_PATHS_BASE_REQUIRED,
    TSC_COMPILER_INPUT_PATHS,
    TYPESCRIPT_TSCONFIG_CHECK,
    TSC_CONFIGURATION_REQUIRED,
    TSC_REFERENCE_OUTPUT_FOLDER,
} from '#cli/config/checks/language/typescript.ts';

const CHECKED_PROJECTS = { create: () => new Map<string, string>() };

/**
 * Maps absolute paths inside the repository to the scratch copy.
 * @param value the compiler path or paths to map.
 * @param input the source and scratch roots.
 * @returns the mapped paths.
 */
function convertToScratchPath(value: unknown, input: TypeScriptReferenceCopy): unknown {
    if (Array.isArray(value)) return value.map((path: unknown) => convertToScratchPath(path, input));
    if (typeof value !== 'string' || !isAbsolute(value) || !isInside(relative(input.root, value))) return value;
    return join(input.scratchRoot, relative(input.root, value));
}

/**
 * Builds a tsconfig that keeps compiler inputs and sends reference output into the scratch copy.
 * @param input the parsed tsconfig, and the source and scratch roots.
 * @returns the tsconfig for the scratch copy.
 */
function buildReferenceTsconfig(
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
                      return [name, aliases.map((alias) => convertToScratchPath(resolve(base, alias), input))];
                  }),
              );
    return {
        ...config.raw,
        ...Object.fromEntries(
            TSC_CONFIG_INPUT_PATHS.map((name) => [name, convertToScratchPath(config.raw[name], input)]),
        ),
        references: config.projectReferences?.map((reference) => ({
            ...reference,
            path: join(scratchRoot, relative(root, ts.resolveProjectReferencePath(reference))),
        })),
        compilerOptions: {
            ...config.raw.compilerOptions,
            ...Object.fromEntries(
                TSC_COMPILER_INPUT_PATHS.map((name) => [name, convertToScratchPath(config.options[name], input)]),
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
 * Points incremental build metadata into the scratch folder.
 * @param command the tsc arguments to extend.
 * @param options the parsed compiler flags.
 * @param scratch the folder for metadata.
 * @param name the basename to look for.
 */
function appendBuildMetadata(
    command: string[],
    options: ts.CompilerOptions | undefined,
    scratch: string,
    name: string,
): void {
    if (options?.incremental !== true && options?.composite !== true) return;
    command.push(TSBUILDINFO_FLAG, join(scratch, DOT_GSPOT, name));
}

/**
 * Replaces scratch copy paths in the command with repository paths.
 * @param result the compiler run, which may have no command.
 * @param scratch the root of the copy.
 * @param sourceRoot the repository root.
 * @returns the run with repository paths.
 */
function restoreCommandPaths(result: CheckResult, scratch: string, sourceRoot: string): CheckResult {
    if (result.command === undefined) return result;
    return {
        ...result,
        command: result.command.map((part) => part.replaceAll(scratch, () => sourceRoot)),
    };
}

/**
 * Shares a project compile across scopes, but never skips a second run in the same scope.
 * @param reads the run cache.
 * @param projectCheck what identifies the compile.
 * @param projectCheck.check the ID of the planned tsc run.
 * @param projectCheck.path the tsconfig of the project.
 * @param projectCheck.scope the folder that runs it.
 * @param projectCheck.required the compiler flags for one scope.
 * @returns whether another scope already checks this project with these flags.
 */
function isProjectChecked(
    reads: ReadCache,
    projectCheck: { check: string; path: string; scope: string; required: Record<string, boolean> },
): boolean {
    const { check, path, scope, required } = projectCheck;
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
 * Runs tsc on a project and keeps build metadata in metadataRoot.
 * @param session the repository or its scratch copy.
 * @param planned the tsc check for one scope.
 * @param metadataRoot the folder for build metadata.
 * @param project the parsed tsconfig, if any.
 * @returns the check result.
 */
async function runTsc(
    session: Session,
    planned: PlannedCheck,
    metadataRoot: string,
    project: TypeScriptProject | undefined,
): Promise<CheckResult> {
    const required = selectCheckedTsconfigOptions(session.settingsFile.settings.level, planned.selection);
    const target =
        project === undefined ? join(session.root, planned.selection.scope.path, TSCONFIG_FILE) : project.path;
    if (
        isProjectChecked(session.reads, {
            check: planned.check.name,
            path: target,
            scope: planned.selection.scope.path,
            required: required,
        })
    )
        return {
            ...buildBaseResult(planned, session),
            status: 'skipped',
            note: 'An ancestor compiler check covers this project.',
        };
    const command: string[] = [];
    if (project !== undefined && (project.config.projectReferences ?? []).length > 0) {
        command.push(...TSC_BUILD_COMMAND, project.path);
    } else {
        const generatedPath = join(metadataRoot, TOOL_FILES_FOLDER, planned.selection.scope.path, TSCONFIG_FILE);
        writeScopeTsconfig(session, planned.selection, generatedPath);
        command.push(...TSC_PROJECT_COMMAND, generatedPath);
        appendBuildMetadata(command, project?.config.options, metadataRoot, TSCONFIG_TSBUILDINFO);
    }
    command.push(...TSC_PLAIN_OUTPUT);
    return runCheckCommand(session, planned, { command, scratchRoot: session.root });
}

/**
 * Writes a tsconfig for the scope.
 * @param input the scope and target path.
 * @returns the absolute path.
 */
function writeTsconfig(input: TsconfigInput): string {
    const target = join(input.root, input.target);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify(buildTsconfig(input)));
    return target;
}

/**
 * Rewrites each copied tsconfig so reference builds write their output into the scratch copy.
 * @param input the referenced projects and the scratch copy.
 */
function writeReferenceProjects(input: TypeScriptReferenceCopy): void {
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
        writeFileSync(target, JSON.stringify(buildReferenceTsconfig({ ...input, path, config })));
    }
}

/**
 * Builds a tsconfig that extends the authored one, or a standalone one when the scope has none.
 * @param input the scope and target path.
 * @returns the tsconfig.
 */
function buildTsconfig(input: TsconfigInput): Record<string, unknown> {
    const { root, typeRootsFolder, reads, target, scope, files, scopes, options } = input;
    const authored = readTsconfigProject(
        root,
        scope,
        files
            .filter(
                (file) =>
                    (file.tags.includes('typescript') ||
                        DECLARATION_EXTENSIONS.includes(extractExtension(file.path))) &&
                    findScope(file.path, scopes).path === scope,
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
            (file.tags.includes('typescript') || DECLARATION_EXTENSIONS.includes(extractExtension(file.path))) &&
            findScope(file.path, scopes).path === scope,
    );
    // Svelte reads these extra extensions through include; tsc ignores them as unsupported sources.
    const components = files.filter(
        (file) => file.kind === 'source' && file.tags.includes('svelte') && findScope(file.path, scopes).path === scope,
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
 * Selects the compiler flags that the level and configurations require.
 * @param level recommended or all.
 * @param selected the scope manifests.
 * @returns the flags, by name.
 */
function selectRequiredTsconfigOptions(level: Level, selected: Manifest[]): Record<string, boolean> {
    const options: Record<string, boolean> = { ...(level === 'all' ? COMPILER_OPTIONS : RECOMMENDED_OPTIONS) };
    if (selected.some((manifest) => manifest.configuration.name === NESTJS_CONFIGURATION))
        Object.assign(options, NESTJS_COMPILER_OPTIONS);
    return options;
}

/**
 * Drops the compiler flags that the scope turns off.
 * @param level recommended or all.
 * @param selection the scope and its settings.
 * @returns the enabled compiler flags.
 */
function selectCheckedTsconfigOptions(level: Level, selection: ScopeSelection): Record<string, boolean> {
    return Object.fromEntries(
        Object.entries(selectRequiredTsconfigOptions(level, selection.selected)).filter(
            ([name]) => !selection.view.rulesOff(TYPESCRIPT_TSCONFIG_CHECK).includes(name),
        ),
    );
}

/**
 * Writes the tsconfig for a scope, extending its authored tsconfig.
 * @param session the repository and read cache.
 * @param selection where tsc runs, with its settings.
 * @param target where to write the tsconfig.
 * @returns the absolute path.
 */
function writeScopeTsconfig(
    session: Pick<Session, 'root' | 'installedRoot' | 'reads' | 'settingsFile'> & {
        repository: Pick<Session['repository'], 'files' | 'scopes'>;
    },
    selection: ScopeSelection,
    target: string,
): string {
    return writeTsconfig({
        root: session.root,
        typeRootsFolder: session.installedRoot,
        reads: session.reads,
        target: convertToPosixPath(relative(session.root, target)),
        scope: selection.scope.path,
        files: session.repository.files,
        scopes: session.repository.scopes,
        options: selectCheckedTsconfigOptions(session.settingsFile.settings.level, selection),
    });
}

export {
    runTsc,
    isProjectChecked,
    writeScopeTsconfig,
    appendBuildMetadata,
    restoreCommandPaths,
    writeReferenceProjects,
    selectRequiredTsconfigOptions,
};
