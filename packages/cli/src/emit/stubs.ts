// One-line stubs at conventional paths, so editors and bare tool invocations find gspot's configuration.
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

import { applyEdits, modify, parse as parseJsonc } from 'jsonc-parser';

import { toPosix } from '#cli/platform/paths.ts';
import { headerFor } from '#cli/render/templates.ts';
import type { StubSpec } from '#types/manifest.ts';
import type { GeneratedFile } from '#types/render.ts';

/** The relative import path from a stub to its target. */
export function relativeTarget(stubPath: string, targetPath: string): string {
    const rel = toPosix(relative(dirname(stubPath) === '.' ? '' : dirname(stubPath), targetPath));
    return rel.startsWith('./') || rel.startsWith('../') ? rel : `./${rel}`;
}

/** Renders a body stub: the body with {target} replaced, under the header. */
export function bodyStub(
    stub: StubSpec,
    stubPath: string,
    targetPath: string,
    version: string,
    preset: string,
): GeneratedFile {
    const body = (stub.body ?? '').replace(/\{target\}/g, relativeTarget(stubPath, targetPath));
    return {
        path: stubPath,
        content: `${headerFor(stubPath, version)}${body.endsWith('\n') ? body : `${body}\n`}`,
        readOnly: true,
        kind: 'stub',
        preset,
    };
}

/** Renders a merge stub: the existing JSON file with the merge keys set, comments kept. The file is the person's; only the named keys are gspot's. */
export function mergeStub(
    root: string,
    stub: StubSpec,
    stubPath: string,
    targetPath: string,
): { path: string; content: string; keys: string[] } {
    const full = join(root, stubPath);
    let text = existsSync(full) ? readFileSync(full, 'utf8') : '{}\n';
    const keys: string[] = [];
    for (const [key, value] of Object.entries(stub.merge ?? {})) {
        const resolved =
            typeof value === 'string' ? value.replace(/\{target\}/g, relativeTarget(stubPath, targetPath)) : value;
        const edits = modify(text, [key], resolved, { formattingOptions: { insertSpaces: true, tabSize: 4 } });
        text = applyEdits(text, edits);
        keys.push(key);
    }
    return { path: stubPath, content: text, keys };
}

/** True when a merge stub's keys already hold the wanted values. */
export function mergeStubHolds(root: string, stub: StubSpec, stubPath: string, targetPath: string): boolean {
    const full = join(root, stubPath);
    if (!existsSync(full)) return false;
    const data = parseJsonc(readFileSync(full, 'utf8')) as Record<string, unknown> | undefined;
    if (!data) return false;
    for (const [key, value] of Object.entries(stub.merge ?? {})) {
        const resolved =
            typeof value === 'string' ? value.replace(/\{target\}/g, relativeTarget(stubPath, targetPath)) : value;
        if (JSON.stringify(data[key]) !== JSON.stringify(resolved)) return false;
    }
    return true;
}
