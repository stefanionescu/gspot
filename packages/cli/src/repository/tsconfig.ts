import { z } from 'zod';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { dirname, relative, sep } from 'node:path';
import { openConfinedRoot, mutationPath } from '#cli/platform/filesystem.ts';

const configSchema = z.looseObject({ compilerOptions: z.record(z.string(), z.unknown()).optional() });
const EMPTY_FILES = 18_002;
const NO_INPUTS = 18_003;

function configurationText(root: string, path: string): string | undefined {
    const local = relative(root, path).split(sep).join('/');
    const files = openConfinedRoot(root, 'native');
    try {
        const segments = local.split('/');
        const dependency = segments.indexOf('node_modules');
        if (dependency !== -1 && segments[0] !== '.gspot') {
            mutationPath(local);
            if (dependency > 0) files.stat(segments.slice(0, dependency).join('/'));
            return readFileSync(path, 'utf8');
        }
        return files.read(local)?.bytes.toString('utf8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    } finally {
        files.close();
    }
}

/**
 * Resolves compiler options and inherited paths with the TypeScript compiler.
 * @param root the repository boundary for authored configuration
 * @param path the absolute configuration path
 * @returns the parsed configuration, or undefined when the file is absent
 */
export function getTsconfig(root: string, path: string): ts.ParsedCommandLine | undefined {
    try {
        const text = configurationText(root, path);
        if (text === undefined) return undefined;
        const source = ts.parseConfigFileTextToJson(path, text);
        if (source.error !== undefined)
            throw new Error(ts.flattenDiagnosticMessageText(source.error.messageText, '\n'));
        const raw: unknown = source.config;
        const parsed = ts.parseJsonConfigFileContent(
            configSchema.parse(raw),
            { ...ts.sys, readFile: (file) => configurationText(root, file) },
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
