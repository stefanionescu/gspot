import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import type { EngineInput } from '#cli/run/engines.ts';
import type { MergedView } from '#cli/policy/merge.ts';
import { docsHeadings } from '#cli/checks/docs/headings.ts';
import type { CheckSpec } from '#cli/configurations/schema.ts';
import { readmeShape } from '#cli/checks/docs/readme/shape.ts';

function input(root: string, paths: string[], docs: Record<string, unknown> = {}): EngineInput {
    const files = paths.map((path) => ({
        path,
        prefix: Buffer.alloc(0),
        nature: 'source' as const,
        tags: ['text'],
        executable: false,
        size: 1,
    }));
    const partialView: Partial<MergedView> = { tool: () => docs };
    const view = partialView as MergedView;
    const spec: Partial<CheckSpec> = { name: 'docs/readme-shape' };
    const partial: Partial<EngineInput> = { root, scope: '', spec: spec as CheckSpec, files, view, scopeEntries: [] };
    return partial as EngineInput;
}

describe('readme shape', () => {
    test('a README with one H1, an opening paragraph and a setup section passes', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'README.md': '# Thing\n\nWhat it is.\n\n## Setup\n\nRun it.\n' });
        expect(await readmeShape(input(sandbox.path, ['README.md']))).toStrictEqual([]);
    });

    test('a README missing the pieces names each one', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'README.md': '# A\n# B\n## Table of contents\n\nx\n' });
        const found = await readmeShape(input(sandbox.path, ['README.md']));
        expect(found.map((finding) => finding.rule)).toStrictEqual(['one-h1', 'opening-paragraph', 'start-section']);
        const headings = await docsHeadings(input(sandbox.path, ['README.md']));
        expect(headings.map((finding) => finding.line)).toStrictEqual([3]);
    });
    test('setext and formatted headings count, while fenced headings do not', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'README.md':
                'Thing\n=====\n\nWhat it is.\n\nSetup\n-----\n\n~~~md\n# Example\n## Project structure\n~~~~\n',
            'guide.md': '~~~md\n# Project structure\n~~~\n\n**Project structure**\n---------------------\n',
        });
        expect(await readmeShape(input(sandbox.path, ['README.md']))).toStrictEqual([]);
        expect(await docsHeadings(input(sandbox.path, ['README.md']))).toStrictEqual([]);
        const found = await docsHeadings(input(sandbox.path, ['guide.md']));
        expect(found.map((finding) => [finding.line, finding.rule])).toStrictEqual([[5, 'banned-heading']]);
    });

    test('a list before the setup section does not supply an opening paragraph', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'README.md': '# Thing\n\n- An item.\n\n## Setup\n' });
        const found = await readmeShape(input(sandbox.path, ['README.md']));
        expect(found.map((finding) => finding.rule)).toStrictEqual(['opening-paragraph']);
    });
});
