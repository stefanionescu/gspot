import { dirname, relative } from 'node:path';
import { toPosix } from '#cli/platform/paths.ts';
import { headerFor } from '#cli/generation/headers.ts';
import type { GeneratedFile } from '#cli/types/generation/output.ts';
import type { ConfigurationFile } from '#cli/types/configurations.ts';
import { TARGET_PLACEHOLDER } from '#cli/config/generation/pointers.ts';

function fillTarget(value: unknown, pointerPath: string, targetPath: string): unknown {
    if (typeof value !== 'string') return value;
    const target = relativeTarget(pointerPath, targetPath);
    return value.replaceAll(TARGET_PLACEHOLDER, (placeholder) => {
        if (placeholder === '{target_module}') {
            return JSON.stringify(
                target
                    .split('/')
                    .map((segment) => encodeURIComponent(segment))
                    .join('/'),
            );
        }
        return placeholder === '{target_json}' ? JSON.stringify(target) : target;
    });
}

/**
 * Names a generated target relative to its native pointer, including the local-module prefix.
 * @param pointerPath the authored pointer file
 * @param targetPath the generated target file
 * @returns a portable relative path understood by native configuration loaders
 */
export function relativeTarget(pointerPath: string, targetPath: string): string {
    const relativePath = toPosix(relative(dirname(pointerPath), targetPath));
    return relativePath.startsWith('./') || relativePath.startsWith('../') ? relativePath : `./${relativePath}`;
}

/**
 * Renders a body pointer: the body with the target placeholder replaced, under the header.
 * @param pointer the pointer declaration
 * @param pointerPath the pointer's path
 * @param targetPath the generated file's path
 * @param version the gspot version
 * @returns the generated file
 */
export function bodyPointer(
    pointer: NonNullable<ConfigurationFile['stub_file']>,
    pointerPath: string,
    targetPath: string,
    version: string,
): GeneratedFile {
    const body = String(fillTarget(pointer.body ?? '', pointerPath, targetPath));
    const ended = body.endsWith('\n') ? body : `${body}\n`;
    return {
        path: pointerPath,
        content: `${headerFor(pointerPath, version)}${ended}`,
        readOnly: true,
        kind: 'pointer',
    };
}
