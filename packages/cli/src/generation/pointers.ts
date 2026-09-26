import { dirname, relative } from 'node:path';
import { toPosix } from '#cli/platform/paths.ts';
import { headerFor } from '#cli/generation/headers.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { PointerSpec } from '#cli/types/configurations.ts';
import { TARGET_PLACEHOLDER } from '#cli/constants/generation.ts';
import { parse as parseJsonc, type ParseError } from 'jsonc-parser';
import type { ConfigurationOutput, GeneratedFile } from '#cli/types/generation.ts';

function parsePointer(text: string, pointerPath: string): Record<string, unknown> {
    const errors: ParseError[] = [];
    const parsed: unknown = parseJsonc(text, errors, { allowTrailingComma: true });
    if (errors.length > 0 || parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error(`Shared configuration must be a valid JSON object: ${pointerPath}`);
    return parsed as Record<string, unknown>;
}

function fillTarget(value: unknown, pointerPath: string, targetPath: string): unknown {
    if (typeof value !== 'string') return value;
    const target = relativeTarget(pointerPath, targetPath);
    return value.replaceAll(TARGET_PLACEHOLDER, (placeholder) =>
        placeholder === '{target_json}' ? JSON.stringify(target) : target,
    );
}

/**
 * The relative import path from a pointer to its target.
 * @param pointerPath the pointer's path
 * @param targetPath the generated file's path
 * @returns the path starting with ./ or ../
 */
function relativeTarget(pointerPath: string, targetPath: string): string {
    const rel = toPosix(relative(dirname(pointerPath) === '.' ? '' : dirname(pointerPath), targetPath));
    return rel.startsWith('./') || rel.startsWith('../') ? rel : `./${rel}`;
}

/**
 * Renders a body pointer: the body with the target placeholder replaced, under the header.
 * @param pointer the pointer spec
 * @param pointerPath the pointer's path
 * @param targetPath the generated file's path
 * @param version the gspot version
 * @param configuration the configuration that owns the pointer
 * @returns the generated file
 */
export function bodyPointer(
    pointer: PointerSpec,
    pointerPath: string,
    targetPath: string,
    version: string,
    configuration: string,
): GeneratedFile {
    const body = String(fillTarget(pointer.body ?? '', pointerPath, targetPath));
    const ended = body.endsWith('\n') ? body : `${body}\n`;
    return {
        path: pointerPath,
        content: `${headerFor(pointerPath, version)}${ended}`,
        readOnly: true,
        kind: 'pointer',
        configuration,
    };
}

/**
 * Renders a merge pointer: the existing JSON file with the merge keys set, comments kept. The file is the person's; only the named keys belong to gspot.
 * @param root the repository root
 * @param pointer the pointer spec
 * @param pointerPath the pointer's path
 * @param targetPath the generated file's path
 * @returns the path, the new text and the keys gspot owns
 */
export function mergePointer(
    root: string,
    pointer: PointerSpec,
    pointerPath: string,
    targetPath: string,
): ConfigurationOutput {
    const files = openConfinedRoot(root);
    try {
        const text = files.read(pointerPath)?.bytes.toString('utf8') ?? '{}\n';
        parsePointer(text, pointerPath);
        return {
            path: pointerPath,
            format: 'json',
            changes: Object.entries(pointer.merge ?? {}).map(([key, value]) => ({
                path: [key],
                value: fillTarget(value, pointerPath, targetPath),
            })),
        };
    } finally {
        files.close();
    }
}
