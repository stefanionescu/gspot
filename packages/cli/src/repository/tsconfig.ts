import ts from 'typescript';
import { relative } from 'node:path';
import { readFileSync } from 'node:fs';
import { toPosix } from '#cli/platform/paths.ts';
import { readText } from '#cli/platform/source.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { parseTsconfig } from '#cli/parsers/tsconfig.ts';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import { portableSegments } from '#cli/platform/root/rules.ts';

function configurationText(root: string, path: string): string | undefined {
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
        return readText(root, local);
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
        throw error;
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
        return parseTsconfig(path, text, { ...ts.sys, readFile: (file) => configurationText(root, file) });
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot read TypeScript configuration ${path}: ${detail}`, { cause: error });
    }
}
