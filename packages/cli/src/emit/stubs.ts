// One-line stubs at conventional paths, so editors and bare tool invocations find the gspot configuration.
import { toPosix } from '#cli/platform/paths.ts';
import type { StubSpec } from '#cli/presets/types.ts';
import { openConfinedRoot } from '#cli/lifecycle/confined.ts';
import { headerFor } from '#cli/emit/templates.ts';
import type { GeneratedFile } from '#cli/emit/types.ts';
import { relative, dirname } from 'node:path';
import { applyEdits, modify, parse as parseJsonc, type ParseError } from 'jsonc-parser';

const TARGET_PLACEHOLDER = /\{target(?:_json)?\}/gu;
const JSON_INDENT = 4;

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
 * Renders a merge stub: the existing JSON file with the merge keys set, comments kept. The file is the person's; only the named keys belong to gspot.
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
    let text = openConfinedRoot(root).read(stubPath)?.bytes.toString('utf8') ?? '{}\n';
    parseStub(text, stubPath);
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
    const current = openConfinedRoot(root).read(stubPath);
    if (current === undefined) return false;
    const parsed = parseStub(current.bytes.toString('utf8'), stubPath);
    const entries = Object.entries(stub.merge ?? {});
    return entries.every(
        ([key, value]) => JSON.stringify(parsed[key]) === JSON.stringify(fillTarget(value, stubPath, targetPath)),
    );
}
