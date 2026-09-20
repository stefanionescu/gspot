import { createSandbox } from '@gspot/testing';
import { describe, expect, test } from 'bun:test';
import type { MergedView } from '#types/config.ts';
import type { CheckSpec } from '#types/manifest.ts';
import type { Repository } from '#types/repository.ts';
import type { EngineInput, Session } from '#types/run.ts';
import { readmeShape } from '#cli/integrity/readme/shape.ts';
import { docsHeadings } from '#cli/integrity/docs-headings.ts';

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
    const repository: Partial<Repository> = { files, scopes: [] };
    const partialSession: Partial<Session> = { repository: repository as Repository };
    const session = partialSession as Session;
    const spec: Partial<CheckSpec> = { name: 'docs/readme-shape' };
    const partial: Partial<EngineInput> = { root, scope: '', spec: spec as CheckSpec, files, view, session };
    return partial as EngineInput;
}

describe('readme shape', () => {
    test('a README with one H1, an opening paragraph and a setup section passes', async () => {
        await using sandbox = await createSandbox({ 'README.md': '# Thing\n\nWhat it is.\n\n## Setup\n\nRun it.\n' });
        expect(await readmeShape(input(sandbox.path, ['README.md']))).toEqual([]);
    });

    test('a README missing the pieces names each one', async () => {
        await using sandbox = await createSandbox({ 'README.md': '# A\n# B\n## Table of contents\n\nx\n' });
        const found = await readmeShape(input(sandbox.path, ['README.md']));
        expect(found.map((finding) => finding.rule)).toEqual(['one-h1', 'opening-paragraph', 'start-section']);
        const headings = await docsHeadings(input(sandbox.path, ['README.md']));
        expect(headings.map((finding) => finding.line)).toEqual([3]);
    });
    test('setext and formatted headings count, while fenced headings do not', async () => {
        await using sandbox = await createSandbox({
            'README.md':
                'Thing\n=====\n\nWhat it is.\n\nSetup\n-----\n\n~~~md\n# Example\n## Project structure\n~~~~\n',
            'guide.md': '~~~md\n# Project structure\n~~~\n\n**Project structure**\n---------------------\n',
        });
        expect(await readmeShape(input(sandbox.path, ['README.md']))).toEqual([]);
        expect(await docsHeadings(input(sandbox.path, ['README.md']))).toEqual([]);
        const found = await docsHeadings(input(sandbox.path, ['guide.md']));
        expect(found.map((finding) => [finding.line, finding.rule])).toEqual([[5, 'banned-heading']]);
    });

    test('a list before the setup section does not supply an opening paragraph', async () => {
        await using sandbox = await createSandbox({ 'README.md': '# Thing\n\n- An item.\n\n## Setup\n' });
        const found = await readmeShape(input(sandbox.path, ['README.md']));
        expect(found.map((finding) => finding.rule)).toEqual(['opening-paragraph']);
    });
});
