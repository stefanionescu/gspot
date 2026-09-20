import { z } from 'zod';
import ts from 'typescript';
import { dirname } from 'node:path';
import { readFileSync } from 'node:fs';

const configSchema = z.looseObject({ compilerOptions: z.record(z.string(), z.unknown()).optional() });
const EMPTY_FILES = 18_002;
const NO_INPUTS = 18_003;

function configurationText(path: string): string | undefined {
    try {
        return readFileSync(path, 'utf8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}

/**
 * Resolves compiler options and inherited paths with the TypeScript compiler.
 * @param path the absolute configuration path
 * @param generated configurations being rendered before they exist on disk
 * @returns the parsed configuration, or undefined when the file is absent
 */
export function getTsconfig(
    path: string,
    generated: ReadonlyMap<string, string> = new Map(),
): ts.ParsedCommandLine | undefined {
    try {
        const read = (file: string): string | undefined => generated.get(file) ?? configurationText(file);
        const text = read(path);
        if (text === undefined) return undefined;
        const source = ts.parseConfigFileTextToJson(path, text);
        if (source.error !== undefined)
            throw new Error(ts.flattenDiagnosticMessageText(source.error.messageText, '\n'));
        const raw: unknown = source.config;
        const parsed = ts.parseJsonConfigFileContent(
            configSchema.parse(raw),
            { ...ts.sys, readFile: read, fileExists: (file) => generated.has(file) || ts.sys.fileExists(file) },
            dirname(path),
            undefined,
            path,
        );
        // Option and alias consumers also read configurations with no input files.
        const errors = parsed.errors.filter((error) => error.code !== EMPTY_FILES && error.code !== NO_INPUTS);
        if (errors.length > 0)
            throw new Error(errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'));
        return parsed;
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot read TypeScript configuration ${path}: ${detail}`, { cause: error });
    }
}
