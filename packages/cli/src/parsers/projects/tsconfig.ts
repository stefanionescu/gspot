import type ts from 'typescript';
import { remember } from '#cli/system/cache.ts';
import { readFileSync, realpathSync } from 'node:fs';
import { NODE_MODULES } from '#cli/config/files/names.ts';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import type { RunCache } from '#cli/types/system/cache.ts';
import { requireTypescript } from '#cli/system/typescript.ts';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import { find, readContainedPath } from '#cli/system/files/reads.ts';
import { join, dirname, resolve, relative, isAbsolute } from 'node:path';
import { tsconfigSchema } from '#cli/schemas/parsers/projects/tsconfig.ts';
import { isInside, convertToPosixPath, listEnclosingFolders } from '#cli/system/paths.ts';
import type { ParsedTsconfig, TypeScriptProject } from '#cli/types/parsers/projects/tsconfig.ts';

import {
    TSCONFIG_FILE,
    TS_NO_FILES_CODE,
    TS_EMPTY_FILES_CODE,
    MISSING_EXTENDED_CONFIG,
} from '#cli/config/parsers/projects/tsconfig.ts';

const PARSED_TSCONFIGS = Symbol('parsed tsconfigs');

function readReferencedProjects(root: string, path: string, cache: RunCache): Map<string, ParsedTsconfig> {
    const ts = requireTypescript();
    const projects = new Map<string, ParsedTsconfig>();
    const pending = [resolve(path)];
    const owners = new Map<string, string>();
    for (let projectPath = pending.shift(); projectPath !== undefined; projectPath = pending.shift()) {
        if (projects.has(projectPath)) continue;
        const parsed = readTsconfig(root, projectPath, cache);
        if (parsed === undefined)
            throw new GspotError(
                'configuration',
                `${convertToPosixPath(relative(root, owners.get(projectPath) ?? path))} references ${convertToPosixPath(relative(root, projectPath))}, which has no tsconfig.json. Fix the reference.`,
            );
        projects.set(projectPath, parsed);
        pending.push(
            ...(parsed.projectReferences ?? []).map((reference) => {
                const referenced = resolve(ts.resolveProjectReferencePath(reference));
                owners.set(referenced, projectPath);
                return referenced;
            }),
        );
    }
    return projects;
}

function parseTsconfig(path: string, text: string, host: ts.ParseConfigHost): ParsedTsconfig {
    const ts = requireTypescript();
    const fileName = convertToPosixPath(path);
    const source = ts.parseConfigFileTextToJson(fileName, text);
    if (source.error !== undefined) throw new Error(ts.flattenDiagnosticMessageText(source.error.messageText, '\n'));
    const json: unknown = source.config;
    const authored = tsconfigSchema.parse(json);
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
        (error) => error.code !== TS_EMPTY_FILES_CODE && error.code !== TS_NO_FILES_CODE,
    );
    if (errors.length > 0)
        throw new Error(errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'));
    return {
        ...parsed,
        raw: authored,
        tsconfigFiles,
        extendedTsconfigFiles: sourceFile.extendedSourceFiles ?? [],
    };
}

function buildCompilerHost(
    root: string,
    scopePath: string,
    cache: RunCache,
    options: ts.CompilerOptions,
): ts.CompilerHost {
    const ts = requireTypescript();
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
    host.getCurrentDirectory = () => join(root, scopePath);
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
            : readCompilerFile(root, path, cache);
    return host;
}

function readCompilerFile(root: string, path: string, cache: RunCache): string | undefined {
    const local = convertToPosixPath(relative(root, path));
    try {
        const segments = local.split('/');
        const dependency = segments.indexOf(NODE_MODULES);
        if (dependency !== -1 && segments[0] !== GSPOT_FOLDER) {
            if (dependency > 0 && isInside(local))
                readContainedPath(realpathSync(root), segments.slice(0, dependency).join('/'));
            return readFileSync(path, 'utf8');
        }
        return find(cache, local);
    } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) return undefined;
        throw error;
    }
}

function buildTsconfigError(path: string, error: unknown): GspotError {
    const detail = error instanceof Error ? error.message : String(error);
    const missing = MISSING_EXTENDED_CONFIG.exec(detail)?.[1];
    const message =
        missing !== undefined && !missing.startsWith('.') && !isAbsolute(missing)
            ? `${path} extends ${missing}, which is not installed. Install the project dependencies, then run the command again.`
            : `Cannot read the compiler settings in ${path}: ${detail}`;
    return new GspotError('configuration', message, { cause: error });
}

/**
Resolve compiler options and inherited paths with the TypeScript compiler.

@param root the base folder of the cached readers.
@param path the absolute tsconfig file.
@param cache the run cache.
@returns undefined when the file does not exist.
*/
export function readTsconfig(root: string, path: string, cache: RunCache): ParsedTsconfig | undefined {
    const ts = requireTypescript();
    try {
        return remember(
            cache,
            PARSED_TSCONFIGS,
            JSON.stringify([root, resolve(path)]),
            (): ParsedTsconfig | undefined => {
                const text = readCompilerFile(root, path, cache);
                return text === undefined
                    ? undefined
                    : parseTsconfig(path, text, {
                          ...ts.sys,
                          readFile: (file) => readCompilerFile(root, file, cache),
                      });
            },
        );
    } catch (error) {
        throw buildTsconfigError(convertToPosixPath(relative(root, path)), error);
    }
}

/**
Find the nearest TypeScript project that includes every source of a scope.

@param root the base folder of the cached readers.
@param scopePath the repository-relative folder.
@param files the source paths of the scope.
@param cache the run cache.
@returns undefined for a standalone scope.
*/
export function readTsconfigProject(
    root: string,
    scopePath: string,
    files: string[],
    cache: RunCache,
): TypeScriptProject | undefined {
    for (const folder of listEnclosingFolders(scopePath)) {
        const path = join(root, folder, TSCONFIG_FILE);
        const config = readTsconfig(root, path, cache);
        if (config === undefined) continue;
        const projects = readReferencedProjects(root, path, cache);
        const members = new Set(
            projects.values().flatMap((project) => project.fileNames.map((file) => convertToPosixPath(file))),
        );
        return folder !== scopePath && files.some((file) => !members.has(convertToPosixPath(join(root, file))))
            ? undefined
            : { path, config, projects };
    }
    return undefined;
}

/**
Resolve the source inputs through the tsconfig of the project.

@param root the base folder of the cached readers.
@param scopePath the importing project folder.
@param cache the run cache.
@param config the parsed project.
@returns resolved source files without installed or compiler libraries.
*/
export function listSourceFiles(
    root: string,
    scopePath: string,
    cache: RunCache,
    config: ParsedTsconfig,
): ts.SourceFile[] {
    const ts = requireTypescript();
    const program = ts.createProgram({
        rootNames: config.fileNames,
        options: config.options,
        ...(config.projectReferences !== undefined && { projectReferences: config.projectReferences }),
        host: buildCompilerHost(root, scopePath, cache, config.options),
    });
    return program
        .getSourceFiles()
        .filter(
            (source) => !program.isSourceFileDefaultLibrary(source) && !program.isSourceFileFromExternalLibrary(source),
        );
}
