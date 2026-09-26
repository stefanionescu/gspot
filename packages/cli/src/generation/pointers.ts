import type { StubSpec } from '#cli/configurations/schema.ts';
import { headerFor } from '#cli/generation/headers.ts';
import type { ConfigurationOutput, GeneratedFile } from '#cli/lifecycle/apply.ts';
import { dirname, relative } from 'node:path';

import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { toPosix } from '#cli/platform/paths.ts';
import { parse as parseJsonc, type ParseError } from 'jsonc-parser';

const TARGET_PLACEHOLDER = /\{target(?:_json)?\}/gu;

function parseStub(text: string, stubPath: string): Record<string, unknown> {
    const errors: ParseError[] = [];
    const parsed: unknown = parseJsonc(text, errors, { allowTrailingComma: true });
    if (errors.length > 0 || parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error(`Shared configuration must be a valid JSON object: ${stubPath}`);
    return parsed as Record<string, unknown>;
}

function fillTarget(value: unknown, stubPath: string, targetPath: string): unknown {
    if (typeof value !== 'string') return value;
    const target = relativeTarget(stubPath, targetPath);
    return value.replaceAll(TARGET_PLACEHOLDER, (placeholder) =>
        placeholder === '{target_json}' ? JSON.stringify(target) : target,
    );
}

/**
 * The relative import path from a stub to its target.
 * @param stubPath the stub's path
 * @param targetPath the generated file's path
 * @returns the path starting with ./ or ../
 */
function relativeTarget(stubPath: string, targetPath: string): string {
    const rel = toPosix(relative(dirname(stubPath) === '.' ? '' : dirname(stubPath), targetPath));
    return rel.startsWith('./') || rel.startsWith('../') ? rel : `./${rel}`;
}

/**
 * Renders a body stub: the body with the target placeholder replaced, under the header.
 * @param stub the stub spec
 * @param stubPath the stub's path
 * @param targetPath the generated file's path
 * @param version the gspot version
 * @param configuration the configuration that owns the stub
 * @returns the generated file
 */
export function bodyStub(
    stub: StubSpec,
    stubPath: string,
    targetPath: string,
    version: string,
    configuration: string,
): GeneratedFile {
    const body = String(fillTarget(stub.body ?? '', stubPath, targetPath));
    const ended = body.endsWith('\n') ? body : `${body}\n`;
    return {
        path: stubPath,
        content: `${headerFor(stubPath, version)}${ended}`,
        readOnly: true,
        kind: 'stub',
        configuration,
    };
}

/**
 * Renders a merge stub: the existing JSON file with the merge keys set, comments kept. The file is the person's; only the named keys belong to gspot.
 * @param root the repository root
 * @param stub the stub spec
 * @param stubPath the stub's path
 * @param targetPath the generated file's path
 * @returns the path, the new text and the keys gspot owns
 */
export function mergeStub(root: string, stub: StubSpec, stubPath: string, targetPath: string): ConfigurationOutput {
    const files = openConfinedRoot(root);
    try {
        const text = files.read(stubPath)?.bytes.toString('utf8') ?? '{}\n';
        parseStub(text, stubPath);
        return {
            path: stubPath,
            format: 'json',
            changes: Object.entries(stub.merge ?? {}).map(([key, value]) => ({
                path: [key],
                value: fillTarget(value, stubPath, targetPath),
            })),
        };
    } finally {
        files.close();
    }
}
