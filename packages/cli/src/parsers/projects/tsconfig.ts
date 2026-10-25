import ts from 'typescript';
import { readFileSync, realpathSync } from 'node:fs';
import { DOT_GSPOT } from '#cli/config/gspot-folder.ts';
import { NODE_MODULES } from '#cli/config/files/names.ts';
import { getCachedValue } from '#cli/system/files/cache.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { join, dirname, resolve, relative } from 'node:path';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import { findCachedText, readContainedPath } from '#cli/system/files/reads.ts';
import { typeScriptConfigSchema } from '#cli/schemas/parsers/projects/tsconfig.ts';
import { isInside, convertToPosixPath, listEnclosingFolders } from '#cli/system/paths.ts';
import type { TypeScriptProject, TypeScriptConfiguration } from '#cli/types/parsers/projects/tsconfig.ts';
import { TSCONFIG_FILE, TSC_NO_FILES_CODE, TS_EMPTY_FILES_CODE } from '#cli/config/parsers/projects/tsconfig.ts';

const PARSED_TSCONFIGS = { create: () => new Map<string, TypeScriptConfiguration | undefined>() };

function readReferencedProjects(root: string, path: string, reads: ReadCache): Map<string, TypeScriptConfiguration> {
    const projects = new Map<string, TypeScriptConfiguration>();
    const pending = [resolve(path)];
    for (let projectPath = pending.shift(); projectPath !== undefined; projectPath = pending.shift()) {
        if (projects.has(projectPath)) continue;
        const parsed = readTsconfig(root, projectPath, reads);
        if (parsed === undefined) throw new Error(`Missing TypeScript project: ${projectPath}`);
        projects.set(projectPath, parsed);
        pending.push(
            ...(parsed.projectReferences ?? []).map((reference) => resolve(ts.resolveProjectReferencePath(reference))),
        );
    }
    return projects;
}

function parseTsconfig(path: string, text: string, host: ts.ParseConfigHost): TypeScriptConfiguration {
    const fileName = convertToPosixPath(path);
    const source = ts.parseConfigFileTextToJson(fileName, text);
    if (source.error !== undefined) throw new Error(ts.flattenDiagnosticMessageText(source.error.messageText, '\n'));
    const json: unknown = source.config;
    const authored = typeScriptConfigSchema.parse(json);
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

function buildCompilerHost(
    root: string,
    scope: string,
    reads: ReadCache,
    options: ts.CompilerOptions,
): ts.CompilerHost {
    const host = ts.createCompilerHost(options);
    const libraryFile = ts.getDefaultLibFilePath(options);
    const libraries = new Set([dirname(dirname(libraryFile))]);
    const readCanonicalPath = host.realpath?.bind(host);
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
    host.getCurrentDirectory = () => join(root, scope);
    host.realpath = (path) => {
        const target = readCanonicalPath?.(path) ?? path;
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

function readCompilerFile(root: string, path: string, reads: ReadCache): string | undefined {
    const local = convertToPosixPath(relative(root, path));
    try {
        const segments = local.split('/');
        const dependency = segments.indexOf(NODE_MODULES);
        if (dependency !== -1 && segments[0] !== DOT_GSPOT) {
            if (dependency > 0 && isInside(local))
                readContainedPath(realpathSync(root), segments.slice(0, dependency).join('/'));
            return readFileSync(path, 'utf8');
        }
        return findCachedText(reads, local);
    } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) return undefined;
        throw error;
    }
}

/**
Resolve compiler options and inherited paths with the TypeScript compiler.

@param root the base folder of the cached readers.
@param path the absolute tsconfig file.
@param reads the run cache.
@returns the parsed settings, or undefined when the file does not exist.
*/
export function readTsconfig(root: string, path: string, reads: ReadCache): TypeScriptConfiguration | undefined {
    const configurations = getCachedValue(reads, PARSED_TSCONFIGS);
    const key = JSON.stringify([root, resolve(path)]);
    if (configurations.has(key)) return configurations.get(key);
    try {
        const text = readCompilerFile(root, path, reads);
        const parsed =
            text === undefined
                ? undefined
                : parseTsconfig(path, text, {
                      ...ts.sys,
                      readFile: (file) => readCompilerFile(root, file, reads),
                  });
        configurations.set(key, parsed);
        return parsed;
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        const shown = convertToPosixPath(relative(root, path));
        throw new GspotError('configuration', `Cannot read the compiler settings in ${shown}: ${detail}`, {
            cause: error,
        });
    }
}

/**
Find the nearest TypeScript project that includes every source of a scope.

@param root the base folder of the cached readers.
@param scope the repository-relative folder.
@param files the source paths of the scope.
@param reads the run cache.
@returns the project, or undefined for a standalone scope.
*/
export function readTsconfigProject(
    root: string,
    scope: string,
    files: string[],
    reads: ReadCache,
): TypeScriptProject | undefined {
    for (const folder of listEnclosingFolders(scope)) {
        const path = join(root, folder, TSCONFIG_FILE);
        const config = readTsconfig(root, path, reads);
        if (config === undefined) continue;
        const projects = readReferencedProjects(root, path, reads);
        const members = new Set(
            projects.values().flatMap((project) => project.fileNames.map((file) => convertToPosixPath(file))),
        );
        return folder !== scope && files.some((file) => !members.has(convertToPosixPath(join(root, file))))
            ? undefined
            : { path, config, projects };
    }
    return undefined;
}

/**
Resolve the source inputs through the tsconfig of the project.

@param root the base folder of the cached readers.
@param scope the importing project folder.
@param reads the run cache.
@param config the parsed project.
@returns resolved source files without installed or compiler libraries.
*/
export function listSourceFiles(
    root: string,
    scope: string,
    reads: ReadCache,
    config: TypeScriptConfiguration,
): ts.SourceFile[] {
    const program = ts.createProgram({
        rootNames: config.fileNames,
        options: config.options,
        ...(config.projectReferences !== undefined && { projectReferences: config.projectReferences }),
        host: buildCompilerHost(root, scope, reads, config.options),
    });
    return program
        .getSourceFiles()
        .filter(
            (source) => !program.isSourceFileDefaultLibrary(source) && !program.isSourceFileFromExternalLibrary(source),
        );
}
