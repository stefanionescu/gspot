// Reads TypeScript project files and compiler options.
import { z } from 'zod';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { openFiles } from '#cli/system/files/open.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { DOT_GSPOT } from '#cli/config/system/locations.ts';
import { getCachedValue } from '#cli/system/files/cache.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { join, dirname, resolve, relative } from 'node:path';
import { splitPortablePath } from '#cli/system/files/names.ts';
import { NODE_MODULES } from '#cli/config/repository/tracked.ts';
import { isInside, convertToPosixPath } from '#cli/system/paths.ts';
import type { TypeScriptProject, TypeScriptConfiguration } from '#cli/types/parsers/tsconfig.ts';
import { TSCONFIG_FILE, TS_NO_INPUTS_CODE, TS_EMPTY_FILES_CODE } from '#cli/config/parsers/tsconfig.ts';

const typeScriptConfigSchema = z.looseObject({
    compilerOptions: z.record(z.string(), z.unknown()).optional(),
} satisfies SchemaShape<Pick<TypeScriptConfiguration['raw'], 'compilerOptions'>>);

const TSCONFIG_MEMO = { create: () => new Map<string, TypeScriptConfiguration | undefined>() };

/**
 * Resolve a project and every project it references with the run-owned configuration cache.
 * @param root the repository root.
 * @param path the absolute project path.
 * @param reads the run-owned reads.
 * @returns actual parsed projects indexed by their absolute system paths.
 */
function tsconfigProjects(root: string, path: string, reads: ReadCache): Map<string, TypeScriptConfiguration> {
    const projects = new Map<string, TypeScriptConfiguration>();
    const pending = [resolve(path)];
    for (const candidate of pending) {
        if (projects.has(candidate)) continue;
        const parsed = readTsconfig(root, candidate, reads);
        if (parsed === undefined) throw new Error(`Missing TypeScript project: ${candidate}`);
        projects.set(candidate, parsed);
        pending.push(
            ...(parsed.projectReferences ?? []).map((reference) => resolve(ts.resolveProjectReferencePath(reference))),
        );
    }
    return projects;
}

/**
 * Parses compiler options and inherited configuration with the TypeScript compiler.
 * @param path the absolute configuration path.
 * @param text the configuration source.
 * @param host the caller's file discovery and configuration reader.
 * @returns the parsed compiler configuration.
 */
function parseTsconfig(path: string, text: string, host: ts.ParseConfigHost): TypeScriptConfiguration {
    const source = ts.parseConfigFileTextToJson(path, text);
    if (source.error !== undefined) throw new Error(ts.flattenDiagnosticMessageText(source.error.messageText, '\n'));
    const raw: unknown = source.config;
    const authored = typeScriptConfigSchema.parse(raw);
    const configurationFiles = [path];
    const sourceFile: ts.TsConfigSourceFile = ts.parseJsonText(path, text);
    const parsed = ts.parseJsonSourceFileConfigFileContent(
        sourceFile,
        {
            ...host,
            readFile: (file) => {
                const contents = host.readFile(file);
                if (contents !== undefined) configurationFiles.push(file);
                return contents;
            },
        },
        dirname(path),
        undefined,
        path,
    );
    // Option and alias consumers also read configurations with no input files.
    const errors = parsed.errors.filter(
        (error) => error.code !== TS_EMPTY_FILES_CODE && error.code !== TS_NO_INPUTS_CODE,
    );
    if (errors.length > 0)
        throw new Error(errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'));
    return {
        ...parsed,
        raw: authored,
        configurationFiles,
        extendedConfigurationFiles: sourceFile.extendedSourceFiles ?? [],
    };
}

/**
 * Read compiler libraries through their observed installed package tree.
 * @param root the captured repository.
 * @param scope the compiler scope.
 * @param reads the captured read cache.
 * @param options the TypeScript compiler options.
 * @returns the guarded TypeScript compiler host.
 */
function compilerHost(root: string, scope: string, reads: ReadCache, options: ts.CompilerOptions): ts.CompilerHost {
    const host = ts.createCompilerHost(options);
    const libraries = new Set([dirname(dirname(ts.getDefaultLibFilePath(options)))]);
    const nativeRealpath = host.realpath?.bind(host);
    const nativeSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (path, languageVersion, _onError, createSource) =>
        nativeSourceFile(
            path,
            languageVersion,
            (message) => {
                throw new Error(message);
            },
            createSource,
        );
    host.getCurrentDirectory = () => join(root, scope);
    host.realpath = (path) => {
        const target = nativeRealpath?.(path) ?? path;
        const local = convertToPosixPath(relative(root, path));
        if (
            (isInside(local) && local.split('/').includes(NODE_MODULES)) ||
            [...libraries].some((library) => isInside(relative(library, path)))
        ) {
            const marker = convertToPosixPath(target).indexOf(`/${NODE_MODULES}/`);
            if (marker !== -1) libraries.add(target.slice(0, marker + `/${NODE_MODULES}`.length));
        }
        return target;
    };
    host.readFile = (path) =>
        [...libraries].some((library) => isInside(relative(library, path)))
            ? ts.sys.readFile(path)
            : readCompilerFile(root, path, reads);
    return host;
}

/**
 * Read a file for the TypeScript compiler, following links into node_modules.
 * @param root the source repository.
 * @param path the absolute system input path.
 * @param reads the repository read cache.
 * @returns source text, or undefined for a missing input.
 */
function readCompilerFile(root: string, path: string, reads: ReadCache): string | undefined {
    const local = convertToPosixPath(relative(root, path));
    using files = openFiles(root, 'system');
    try {
        const segments = local.split('/');
        const dependency = segments.indexOf(NODE_MODULES);
        if (dependency !== -1 && segments[0] !== DOT_GSPOT) {
            // Follow linked dependency folders. Refuse links preceding node_modules.
            splitPortablePath(local);
            if (dependency > 0) files.stat(segments.slice(0, dependency).join('/'));
            return readFileSync(path, 'utf8');
        }
        return readText(root, local, reads);
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
        throw error;
    }
}

/**
 * Resolves compiler options and inherited paths with the TypeScript compiler.
 * @param root the repository root for the tool file.
 * @param path the absolute configuration path.
 * @param reads the configuration cache owned by this run.
 * @returns the parsed configuration, or undefined when the file does not exist.
 */
export function readTsconfig(root: string, path: string, reads: ReadCache): TypeScriptConfiguration | undefined {
    const configurations = getCachedValue(reads, TSCONFIG_MEMO);
    const key = JSON.stringify([root, resolve(path)]);
    if (configurations.has(key)) return configurations.get(key);
    try {
        const text = readCompilerFile(root, path, reads);
        const parsed =
            text === undefined
                ? undefined
                : parseTsconfig(path, text, { ...ts.sys, readFile: (file) => readCompilerFile(root, file, reads) });
        configurations.set(key, parsed);
        return parsed;
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot read TypeScript configuration ${path}: ${detail}`, { cause: error });
    }
}

/**
 * Find the nearest TypeScript project that includes every source owned by a scope.
 * @param root the repository boundary.
 * @param scope the repository-relative scope.
 * @param files the scope-owned source paths.
 * @param reads the run-owned configuration cache.
 * @returns the covering project, or no project for a standalone scope.
 */
export function readTsconfigProject(
    root: string,
    scope: string,
    files: string[],
    reads: ReadCache,
): TypeScriptProject | undefined {
    const own = join(root, scope);
    let folder = own;
    let path = join(folder, TSCONFIG_FILE);
    let config = readTsconfig(root, path, reads);
    while (config === undefined && folder !== root) {
        folder = dirname(folder);
        path = join(folder, TSCONFIG_FILE);
        config = readTsconfig(root, path, reads);
    }
    if (config === undefined) return undefined;
    const projects = tsconfigProjects(root, path, reads);
    const members = new Set(
        [...projects.values()].flatMap((project) => project.fileNames.map((file) => convertToPosixPath(file))),
    );
    if (folder !== own && files.some((file) => !members.has(convertToPosixPath(join(root, file))))) return undefined;
    return { path, config, projects };
}

/**
 * Resolve source inputs through the project's TypeScript compiler configuration.
 * @param root the captured repository.
 * @param scope the importing project scope.
 * @param reads the run-owned metadata cache.
 * @param config the parsed project.
 * @returns resolved source files without installed or compiler libraries.
 */
export function projectSources(
    root: string,
    scope: string,
    reads: ReadCache,
    config: TypeScriptConfiguration,
): ts.SourceFile[] {
    const program = ts.createProgram({
        rootNames: config.fileNames,
        options: config.options,
        ...(config.projectReferences === undefined ? {} : { projectReferences: config.projectReferences }),
        host: compilerHost(root, scope, reads, config.options),
    });
    return program
        .getSourceFiles()
        .filter(
            (source) => !program.isSourceFileDefaultLibrary(source) && !program.isSourceFileFromExternalLibrary(source),
        );
}
