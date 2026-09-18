// One-line stubs at conventional paths, so editors and bare tool invocations find gspot's configuration.
import { toPosix } from '#cli/platform/paths.ts';
import type { StubSpec } from '#types/manifest.ts';
import { existsSync, readFileSync } from 'node:fs';
import { headerFor } from '#cli/emit/templates.ts';
import type { GeneratedFile } from '#types/emit.ts';
import { join, relative, dirname } from 'node:path';
import { applyEdits, modify, parse as parseJsonc } from 'jsonc-parser';

const TARGET_PLACEHOLDER = '{target}';
const JSON_INDENT = 4;

function fillTarget(value: unknown, stubPath: string, targetPath: string): unknown {
    if (typeof value !== 'string') return value;
    return value.replaceAll(TARGET_PLACEHOLDER, () => relativeTarget(stubPath, targetPath));
}

/**
 * The relative import path from a stub to its target.
 * @param stubPath the stub's path
 * @param targetPath the generated file's path
 * @returns the path starting with ./ or ../
 */
export function relativeTarget(stubPath: string, targetPath: string): string {
    const rel = toPosix(relative(dirname(stubPath) === '.' ? '' : dirname(stubPath), targetPath));
    return rel.startsWith('./') || rel.startsWith('../') ? rel : `./${rel}`;
}

/**
 * Renders a body stub: the body with {target} replaced, under the header.
 * @param stub the stub spec
 * @param stubPath the stub's path
 * @param targetPath the generated file's path
 * @param version the gspot version
 * @param preset the preset that owns the stub
 * @returns the generated file
 */
export function bodyStub(
    stub: StubSpec,
    stubPath: string,
    targetPath: string,
    version: string,
    preset: string,
): GeneratedFile {
    const body = String(fillTarget(stub.body ?? '', stubPath, targetPath));
    const ended = body.endsWith('\n') ? body : `${body}\n`;
    return { path: stubPath, content: `${headerFor(stubPath, version)}${ended}`, readOnly: true, kind: 'stub', preset };
}

/**
 * Renders a merge stub: the existing JSON file with the merge keys set, comments kept. The file is the person's; only the named keys are gspot's.
 * @param root the repository root
 * @param stub the stub spec
 * @param stubPath the stub's path
 * @param targetPath the generated file's path
 * @returns the path, the new text and the keys gspot owns
 */
export function mergeStub(
    root: string,
    stub: StubSpec,
    stubPath: string,
    targetPath: string,
): { path: string; content: string; keys: string[] } {
    const full = join(root, stubPath);
    let text = existsSync(full) ? readFileSync(full, 'utf8') : '{}\n';
    const entries = Object.entries(stub.merge ?? {});
    for (const [key, value] of entries) {
        const edits = modify(text, [key], fillTarget(value, stubPath, targetPath), {
            formattingOptions: { insertSpaces: true, tabSize: JSON_INDENT },
        });
        text = applyEdits(text, edits);
    }
    return { path: stubPath, content: text, keys: entries.map(([key]) => key) };
}

/**
 * True when a merge stub's keys already hold the wanted values.
 * @param root the repository root
 * @param stub the stub spec
 * @param stubPath the stub's path
 * @param targetPath the generated file's path
 * @returns whether nothing needs writing
 */
export function isMergeStubHeld(root: string, stub: StubSpec, stubPath: string, targetPath: string): boolean {
    const full = join(root, stubPath);
    if (!existsSync(full)) return false;
    const parsed = parseJsonc(readFileSync(full, 'utf8')) as Record<string, unknown> | undefined;
    if (!parsed) return false;
    const entries = Object.entries(stub.merge ?? {});
    return entries.every(
        ([key, value]) => JSON.stringify(parsed[key]) === JSON.stringify(fillTarget(value, stubPath, targetPath)),
    );
}
