import { z } from 'zod';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { memo } from '#cli/platform/memo.ts';
import { toPosix } from '#cli/platform/paths.ts';
import { readText } from '#cli/platform/source.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { dirname, resolve, relative } from 'node:path';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import { portableSegments } from '#cli/platform/root/rules.ts';
import { TS_NO_INPUTS_CODE, TS_EMPTY_FILES_CODE } from '#cli/config/parsers/tsconfig.ts';

const TSCONFIG_MEMO = { create: () => new Map<string, ts.ParsedCommandLine | undefined>() };

const typeScriptConfigSchema = z.looseObject({ compilerOptions: z.record(z.string(), z.unknown()).optional() });

/**
 * Parses compiler options and inherited configuration with the TypeScript compiler.
 * @param path the absolute configuration path
 * @param text the configuration source
 * @param host the caller's file discovery and configuration reader
 * @returns the parsed compiler configuration
 */
function parseTsconfig(path: string, text: string, host: ts.ParseConfigHost): ts.ParsedCommandLine {
    const source = ts.parseConfigFileTextToJson(path, text);
    if (source.error !== undefined) throw new Error(ts.flattenDiagnosticMessageText(source.error.messageText, '\n'));
    const raw: unknown = source.config;
    const parsed = ts.parseJsonConfigFileContent(
        typeScriptConfigSchema.parse(raw),
        host,
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
    return parsed;
}

function configurationText(root: string, path: string, reads: ReadCache): string | undefined {
    const local = toPosix(relative(root, path));
    using files = openRoot(root, 'native');
    try {
        const segments = local.split('/');
        const dependency = segments.indexOf('node_modules');
        if (dependency !== -1 && segments[0] !== DOT_GSPOT) {
            // Package managers link dependency folders; follow those links, but refuse links above node_modules.
            portableSegments(local);
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
 * @param root the repository boundary for authored configuration
 * @param path the absolute configuration path
 * @param reads the configuration cache owned by this run
 * @returns the parsed configuration, or undefined when the file is absent
 */
export function getTsconfig(root: string, path: string, reads: ReadCache): ts.ParsedCommandLine | undefined {
    const configurations = memo(reads, TSCONFIG_MEMO);
    const key = JSON.stringify([root, resolve(path)]);
    if (configurations.has(key)) return configurations.get(key);
    try {
        const text = configurationText(root, path, reads);
        const parsed =
            text === undefined
                ? undefined
                : parseTsconfig(path, text, { ...ts.sys, readFile: (file) => configurationText(root, file, reads) });
        configurations.set(key, parsed);
        return parsed;
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot read TypeScript configuration ${path}: ${detail}`, { cause: error });
    }
}
