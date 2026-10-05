import ts from 'typescript';
import { dirname } from 'node:path';
import { typeScriptConfigSchema } from '#cli/parsers/schema/tsconfig.ts';
import { TS_NO_INPUTS_CODE, TS_EMPTY_FILES_CODE } from '#cli/config/parsers/tsconfig.ts';

/**
 * Parses compiler options and inherited configuration with the TypeScript compiler.
 * @param path the absolute configuration path
 * @param text the configuration source
 * @param host the caller's file discovery and configuration reader
 * @returns the parsed compiler configuration
 */
export function parseTsconfig(path: string, text: string, host: ts.ParseConfigHost): ts.ParsedCommandLine {
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
