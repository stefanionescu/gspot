import { z } from 'zod';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { findingAt } from '#cli/checks/finding.ts';
import { join, dirname, relative } from 'node:path';
import { readSource } from '#cli/platform/root/public.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { inspectTool, toolAvailability } from '#cli/tools/public.ts';
import type { SchemaCompiler } from '#cli/types/checks/cloudflare.ts';
import { parseHeaders, parseWrangler, redirectFindings } from '#cli/parsers/tool/public.ts';
import { WRANGLER_FIELDS, REQUIRED_HEADERS } from '#cli/config/checks/platform/cloudflare.ts';

function scopePathsNamed(input: CheckInput, name: string): string[] {
    return input.files.map((file) => file.path).filter((path) => path === name || path.endsWith(`/${name}`));
}

/**
 * The syntax findings of every redirects file.
 * @param input the check input
 * @returns the findings
 */
export function redirects(input: CheckInput): Finding[] {
    return scopePathsNamed(input, '_redirects').flatMap((path) =>
        redirectFindings(readSource(input.root, path, input.reads).toString('utf8')).map((entry) =>
            findingAt(input, { file: path, line: entry.number }, 'syntax', entry.text),
        ),
    );
}

/**
 * Every wrangler configuration parses, names the worker, and pins a compatibility date.
 * @param input the check input
 * @returns the findings
 */
export async function wrangler(input: CheckInput): Promise<Finding[]> {
    const paths = ['wrangler.toml', 'wrangler.json', 'wrangler.jsonc'].flatMap((name) => scopePathsNamed(input, name));
    const ajv = toolPin(input.manifests.values(), 'ajv');
    const wrangler = toolPin(input.manifests.values(), 'wrangler');
    const context = { ...input, cwd: join(input.installedRoot ?? input.root, relative(input.root, input.scopeRoot)) };
    const library = toolAvailability(ajv, inspectTool(context, ajv));
    const executable = toolAvailability(wrangler, inspectTool(context, wrangler));
    if ('status' in library) throw new Error(library.note);
    if ('status' in executable) throw new Error(executable.note);
    const { default: schemaConstructor } = z
        .object({ default: z.custom<SchemaCompiler>((value) => typeof value === 'function') })
        .parse(await import(pathToFileURL(createRequire(library.path).resolve('ajv')).href));
    const validator = new schemaConstructor({ allErrors: true, allowUnionTypes: true, strictSchema: false }).compile(
        JSON.parse(
            await readFile(
                join(
                    dirname(
                        createRequire(executable.path).resolve('wrangler/package.json', {
                            paths: [dirname(executable.path)],
                        }),
                    ),
                    'config-schema.json',
                ),
                'utf8',
            ),
        ),
    );
    return paths.flatMap((path): Finding[] => {
        const { table, error } = parseWrangler(readSource(input.root, path, input.reads).toString('utf8'), path);
        if (error !== undefined) return [findingAt(input, { file: path, line: 1 }, 'syntax', error)];
        const missing = Object.entries(WRANGLER_FIELDS).flatMap(([field, { pattern, rule, message }]) => {
            const value = table[field];
            return typeof value === 'string' && pattern.test(value) ? [] : [{ rule, message }];
        });
        const invalid = validator(table)
            ? []
            : (validator.errors ?? []).map((error) => ({
                  rule: 'schema',
                  message: `${error.instancePath} ${error.message ?? error.keyword}`.trim(),
              }));
        return [...missing, ...invalid].map(({ rule, message }) =>
            findingAt(input, { file: path, line: 1 }, rule, message),
        );
    });
}
/**
 * The syntax findings of every headers file.
 * @param input the check input
 * @returns the findings
 */
export function headers(input: CheckInput): Finding[] {
    return scopePathsNamed(input, '_headers').flatMap((path) =>
        parseHeaders(readSource(input.root, path, input.reads).toString('utf8')).findings.map((entry) =>
            findingAt(input, { file: path, line: entry.number }, 'syntax', entry.text),
        ),
    );
}

/**
 * The headers file sets the security headers for every path.
 * @param input the check input
 * @returns the findings
 */
export function securityHeaders(input: CheckInput): Finding[] {
    return scopePathsNamed(input, '_headers').flatMap((path) => {
        const { blocks } = parseHeaders(readSource(input.root, path, input.reads).toString('utf8'));
        const held = new Map(
            blocks
                .filter((block) => block.path === '/*')
                .flatMap((block) => block.headers.map(({ name, value }) => [name, value])),
        );
        const hasFrameRule = /frame-ancestors/iu.test(held.get('content-security-policy') ?? '');
        return Object.entries(REQUIRED_HEADERS)
            .filter(
                ([name, pattern]) =>
                    !pattern.test(held.get(name) ?? '') && !(name === 'x-frame-options' && hasFrameRule),
            )
            .map(([name]) =>
                findingAt(
                    input,
                    { file: path, line: 1 },
                    'missing-header',
                    `The block for /* sets no valid ${name} header.`,
                ),
            );
    });
}
