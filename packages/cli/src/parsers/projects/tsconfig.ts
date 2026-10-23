// Reads TypeScript project files and compiler options.
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { hasErrorCode } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { DOT_GSPOT } from '#cli/config/gspot-folder.ts';
import { NODE_MODULES } from '#cli/config/files/names.ts';
import { getCachedValue } from '#cli/system/files/cache.ts';
import { findCachedText } from '#cli/system/files/reads.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { join, dirname, resolve, relative } from 'node:path';
import { typeScriptConfigSchema } from '#cli/schemas/parsers/projects/tsconfig.ts';
import { isInside, convertToPosixPath, listEnclosingFolders } from '#cli/system/paths.ts';
import type { TypeScriptProject, TypeScriptConfiguration } from '#cli/types/parsers/projects/tsconfig.ts';
import { TSCONFIG_FILE, TSC_NO_FILES_CODE, TS_EMPTY_FILES_CODE } from '#cli/config/parsers/projects/tsconfig.ts';

const PARSED_TSCONFIGS = { create: () => new Map<string, TypeScriptConfiguration | undefined>() };

/**
 * Read a project and every project it references, with the run cache.
 *
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
    for (const projectPath of pending) {
        if (projects.has(projectPath)) continue;
        const parsed = readTsconfig(repositoryRoot, projectPath, reads);
        if (parsed === undefined) throw new Error(`Missing TypeScript project: ${projectPath}`);
        projects.set(projectPath, parsed);
        pending.push(
            ...(parsed.projectReferences ?? []).map((reference) => resolve(ts.resolveProjectReferencePath(reference))),
        );
    }
    return projects;
}

/**
 * Parse compiler options and inherited settings with the TypeScript compiler.
 *
 * @param path the absolute tsconfig file.
 * @param text the tsconfig contents.
 * @param host finds and reads files for the compiler.
 * @returns the parsed compiler settings.
 */
function parseTsconfig(path: string, text: string, host: ts.ParseConfigHost): TypeScriptConfiguration {
    // The compiler compares file names with forward slashes; a Windows path with backslashes fails its assertions.
    const fileName = convertToPosixPath(path);
    const source = ts.parseConfigFileTextToJson(fileName, text);
    if (source.error !== undefined) throw new Error(ts.flattenDiagnosticMessageText(source.error.messageText, '\n'));
    const raw: unknown = source.config;
    const authored = typeScriptConfigSchema.parse(raw);
    const tsconfigFiles = [path];
    const sourceFile: ts.TsConfigSourceFile = ts.parseJsonText(fileName, text);
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
        dirname(fileName),
        undefined,
        fileName,
    );
    // The option and alias readers also read tsconfig files with no input files.
    const errors = parsed.errors.filter(
        (error) => error.code !== TS_EMPTY_FILES_CODE && error.code !== TSC_NO_FILES_CODE,
    );
    if (errors.length > 0)
        throw new Error(errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'));
    return {
        ...parsed,
        raw: authored,
        tsconfigFiles,
        extendedConfigurationFiles: sourceFile.extendedSourceFiles ?? [],
    };
}

/**
 * Read compiler inputs through the repository cache, and keep the installed library paths.
 *
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
 *
 * @param repositoryRoot the base folder of the cached readers.
 * @param path the absolute input file.
 * @param reads the run cache.
 * @returns source text, or undefined for a missing input.
 */
function readCompilerFile(repositoryRoot: string, path: string, reads: ReadCache): string | undefined {
    const local = convertToPosixPath(relative(repositoryRoot, path));
    try {
        const segments = local.split('/');
        const dependency = segments.indexOf(NODE_MODULES);
        if (dependency !== -1 && segments[0] !== DOT_GSPOT) {
            using files = openFiles(repositoryRoot);
            // Follow linked dependency folders. Refuse links before node_modules.
            if (dependency > 0) files.readStats(segments.slice(0, dependency).join('/'));
            return readFileSync(path, 'utf8');
        }
        return findCachedText(reads, local);
    } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) return undefined;
        throw error;
    }
}

/**
 * Resolve compiler options and inherited paths with the TypeScript compiler.
 *
 * @param repositoryRoot the base folder of the cached readers.
 * @param path the absolute tsconfig file.
 * @param reads the run cache.
 * @returns the parsed settings, or undefined when the file does not exist.
 */
export function readTsconfig(
    repositoryRoot: string,
    path: string,
    reads: ReadCache,
): TypeScriptConfiguration | undefined {
    const configurations = getCachedValue(reads, PARSED_TSCONFIGS);
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
        const shown = convertToPosixPath(relative(repositoryRoot, path));
        throw new Error(`Cannot read the compiler settings in ${shown}: ${detail}`, { cause: error });
    }
}

/**
 * Find the nearest TypeScript project that includes every source of a scope.
 *
 * @param repositoryRoot the base folder of the cached readers.
 * @param scope the repository-relative folder.
 * @param files the source paths of the scope.
 * @param reads the run cache.
 * @returns the project, or undefined for a standalone scope.
 */
export function readTsconfigProject(
    repositoryRoot: string,
    scope: string,
    files: string[],
    reads: ReadCache,
): TypeScriptProject | undefined {
    for (const folder of listEnclosingFolders(scope)) {
        const path = join(repositoryRoot, folder, TSCONFIG_FILE);
        const config = readTsconfig(repositoryRoot, path, reads);
        if (config === undefined) continue;
        const projects = readReferencedProjects(repositoryRoot, path, reads);
        const members = new Set(
            [...projects.values()].flatMap((project) => project.fileNames.map((file) => convertToPosixPath(file))),
        );
        if (folder !== scope && files.some((file) => !members.has(convertToPosixPath(join(repositoryRoot, file)))))
            return undefined;
        return { path, config, projects };
    }
    return undefined;
}

/**
 * Resolve the source inputs through the tsconfig of the project.
 *
 * @param repositoryRoot the base folder of the cached readers.
 * @param scope the importing project folder.
 * @param reads the run cache.
 * @param config the parsed project.
 * @returns resolved source files without installed or compiler libraries.
 */
export function listSourceFiles(
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
