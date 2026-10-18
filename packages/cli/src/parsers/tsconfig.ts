// Reads TypeScript project files and compiler options.
import { z } from 'zod';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { openFiles } from '#cli/system/files/open.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { isMissingFileError } from '#cli/system/errors.ts';
import { DOT_GSPOT } from '#cli/config/system/locations.ts';
import { getCachedValue } from '#cli/system/files/cache.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { join, dirname, resolve, relative } from 'node:path';
import { NODE_MODULES } from '#cli/config/repository/tracked.ts';
import { isInside, convertToPosixPath } from '#cli/system/paths.ts';
import type { TypeScriptProject, TypeScriptConfiguration } from '#cli/types/parsers/tsconfig.ts';
import { TSCONFIG_FILE, TS_NO_INPUTS_CODE, TS_EMPTY_FILES_CODE } from '#cli/config/parsers/tsconfig.ts';

const typeScriptConfigSchema = z.looseObject({
    compilerOptions: z.record(z.string(), z.unknown()).optional(),
} satisfies SchemaShape<Pick<TypeScriptConfiguration['raw'], 'compilerOptions'>>);

const TSCONFIG_MEMO = { create: () => new Map<string, TypeScriptConfiguration | undefined>() };

/**
 * Read a project and every project it references, with the run cache.
 * @param repositoryRoot the base folder of the cached readers.
 * @param path the absolute tsconfig file.
 * @param reads the run cache.
 * @returns the parsed projects by absolute path.
 */
function readReferencedProjects(
    repositoryRoot: string,
    path: string,
    reads: ReadCache,
): Map<string, TypeScriptConfiguration> {
    const projects = new Map<string, TypeScriptConfiguration>();
    const pending = [resolve(path)];
    for (const candidate of pending) {
        if (projects.has(candidate)) continue;
        const parsed = readTsconfig(repositoryRoot, candidate, reads);
        if (parsed === undefined) throw new Error(`Missing TypeScript project: ${candidate}`);
        projects.set(candidate, parsed);
        pending.push(
            ...(parsed.projectReferences ?? []).map((reference) => resolve(ts.resolveProjectReferencePath(reference))),
        );
    }
    return projects;
}

/**
 * Parse compiler options and inherited settings with the TypeScript compiler.
 * @param path the absolute tsconfig file.
 * @param text the tsconfig contents.
 * @param host finds and reads files for the compiler.
 * @returns the parsed compiler settings.
 */
function parseTsconfig(path: string, text: string, host: ts.ParseConfigHost): TypeScriptConfiguration {
    const source = ts.parseConfigFileTextToJson(path, text);
    if (source.error !== undefined) throw new Error(ts.flattenDiagnosticMessageText(source.error.messageText, '\n'));
    const raw: unknown = source.config;
    const authored = typeScriptConfigSchema.parse(raw);
    const tsconfigFiles = [path];
    const sourceFile: ts.TsConfigSourceFile = ts.parseJsonText(path, text);
    const parsed = ts.parseJsonSourceFileConfigFileContent(
        sourceFile,
        {
            ...host,
            readFile: (file) => {
                const contents = host.readFile(file);
                if (contents !== undefined) tsconfigFiles.push(file);
                return contents;
            },
        },
        dirname(path),
        undefined,
        path,
    );
    // The option and alias readers also read tsconfig files with no input files.
    const errors = parsed.errors.filter(
        (error) => error.code !== TS_EMPTY_FILES_CODE && error.code !== TS_NO_INPUTS_CODE,
    );
    if (errors.length > 0)
        throw new Error(errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'));
    return {
        ...parsed,
        raw: authored,
        tsconfigFiles: tsconfigFiles,
        extendedConfigurationFiles: sourceFile.extendedSourceFiles ?? [],
    };
}

/**
 * Read compiler inputs through the repository cache, and keep the installed library paths.
 * @param repositoryRoot the base folder of the cached readers.
 * @param scope the folder relative to the repository.
 * @param reads the run cache.
 * @param options the parsed compiler settings.
 * @returns a compiler host that reads through the cache.
 */
function buildCompilerHost(
    repositoryRoot: string,
    scope: string,
    reads: ReadCache,
    options: ts.CompilerOptions,
): ts.CompilerHost {
    const host = ts.createCompilerHost(options);
    const libraries = new Set([dirname(dirname(ts.getDefaultLibFilePath(options)))]);
    const readRealPath = host.realpath?.bind(host);
    const getSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (path, languageVersion, _onError, createSource) =>
        getSourceFile(
            path,
            languageVersion,
            (message) => {
                throw new Error(message);
            },
            createSource,
        );
    host.getCurrentDirectory = () => join(repositoryRoot, scope);
    host.realpath = (path) => {
        const target = readRealPath?.(path) ?? path;
        const local = convertToPosixPath(relative(repositoryRoot, path));
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
            : readCompilerFile(repositoryRoot, path, reads);
    return host;
}

/**
 * Read a file for the TypeScript compiler, following links into node_modules.
 * @param repositoryRoot the base folder of the cached readers.
 * @param path the absolute input file.
 * @param reads the run cache.
 * @returns source text, or undefined for a missing input.
 */
function readCompilerFile(repositoryRoot: string, path: string, reads: ReadCache): string | undefined {
    const local = convertToPosixPath(relative(repositoryRoot, path));
    using files = openFiles(repositoryRoot);
    try {
        const segments = local.split('/');
        const dependency = segments.indexOf(NODE_MODULES);
        if (dependency !== -1 && segments[0] !== DOT_GSPOT) {
            // Follow linked dependency folders. Refuse links before node_modules.

            if (dependency > 0) files.readStats(segments.slice(0, dependency).join('/'));
            return readFileSync(path, 'utf8');
        }
        return readCachedText(reads, local);
    } catch (error) {
        if (isMissingFileError(error)) return undefined;
        throw error;
    }
}

/**
 * Resolve compiler options and inherited paths with the TypeScript compiler.
 * @param repositoryRoot the base folder of the cached readers.
 * @param path the absolute tsconfig file.
 * @param reads the run cache.
 * @returns the parsed settings, or undefined when the file does not exist.
 */
function readTsconfig(repositoryRoot: string, path: string, reads: ReadCache): TypeScriptConfiguration | undefined {
    const configurations = getCachedValue(reads, TSCONFIG_MEMO);
    const key = JSON.stringify([repositoryRoot, resolve(path)]);
    if (configurations.has(key)) return configurations.get(key);
    try {
        const text = readCompilerFile(repositoryRoot, path, reads);
        const parsed =
            text === undefined
                ? undefined
                : parseTsconfig(path, text, {
                      ...ts.sys,
                      readFile: (file) => readCompilerFile(repositoryRoot, file, reads),
                  });
        configurations.set(key, parsed);
        return parsed;
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot read TypeScript configuration ${path}: ${detail}`, { cause: error });
    }
}

/**
 * Find the nearest TypeScript project that includes every source of a scope.
 * @param repositoryRoot the base folder of the cached readers.
 * @param scope the repository-relative folder.
 * @param files the source paths of the scope.
 * @param reads the run cache.
 * @returns the project, or undefined for a standalone scope.
 */
function readTsconfigProject(
    repositoryRoot: string,
    scope: string,
    files: string[],
    reads: ReadCache,
): TypeScriptProject | undefined {
    const own = join(repositoryRoot, scope);
    let folder = own;
    let path = join(folder, TSCONFIG_FILE);
    let config = readTsconfig(repositoryRoot, path, reads);
    while (config === undefined && folder !== repositoryRoot) {
        folder = dirname(folder);
        path = join(folder, TSCONFIG_FILE);
        config = readTsconfig(repositoryRoot, path, reads);
    }
    if (config === undefined) return undefined;
    const projects = readReferencedProjects(repositoryRoot, path, reads);
    const members = new Set(
        [...projects.values()].flatMap((project) => project.fileNames.map((file) => convertToPosixPath(file))),
    );
    if (folder !== own && files.some((file) => !members.has(convertToPosixPath(join(repositoryRoot, file)))))
        return undefined;
    return { path, config, projects };
}

/**
 * Resolve the source inputs through the tsconfig of the project.
 * @param repositoryRoot the base folder of the cached readers.
 * @param scope the importing project folder.
 * @param reads the run cache.
 * @param config the parsed project.
 * @returns resolved source files without installed or compiler libraries.
 */
function listSourceFiles(
    repositoryRoot: string,
    scope: string,
    reads: ReadCache,
    config: TypeScriptConfiguration,
): ts.SourceFile[] {
    const program = ts.createProgram({
        rootNames: config.fileNames,
        options: config.options,
        ...(config.projectReferences === undefined ? {} : { projectReferences: config.projectReferences }),
        host: buildCompilerHost(repositoryRoot, scope, reads, config.options),
    });
    return program
        .getSourceFiles()
        .filter(
            (source) => !program.isSourceFileDefaultLibrary(source) && !program.isSourceFileFromExternalLibrary(source),
        );
}

export { readTsconfig, listSourceFiles, buildCompilerHost, readTsconfigProject };
