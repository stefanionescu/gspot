import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { checkInput } from '#tests/support/cli/input.ts';
import { docsHeadings } from '#cli/checks/docs/headings.ts';
import { readmeShape } from '#cli/checks/docs/readme/shape.ts';

describe('readme shape', () => {
    test('a README with one H1, an opening paragraph and a setup section passes', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'README.md': '# Thing\n\nWhat it is.\n\n## Setup\n\nRun it.\n' });
        expect(readmeShape(await checkInput(sandbox.path, 'docs/readme-shape', ['README.md']))).toStrictEqual([]);
    });

    test('a README missing the pieces names each one', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'README.md': '# A\n# B\n## Table of contents\n\nx\n' });
        const found = readmeShape(await checkInput(sandbox.path, 'docs/readme-shape', ['README.md']));
        expect(found.map((finding) => finding.rule)).toStrictEqual(['one-h1', 'opening-paragraph', 'start-section']);
        const headings = docsHeadings(await checkInput(sandbox.path, 'integrity/docs-headings', ['README.md']));
        expect(headings.map((finding) => finding.line)).toStrictEqual([3]);
    });
    test('setext and formatted headings count, while fenced headings do not', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'README.md':
                'Thing\n=====\n\nWhat it is.\n\nSetup\n-----\n\n~~~md\n# Example\n## Project structure\n~~~~\n',
            'guide.md': '~~~md\n# Project structure\n~~~\n\n**Project structure**\n---------------------\n',
        });
        expect(readmeShape(await checkInput(sandbox.path, 'docs/readme-shape', ['README.md']))).toStrictEqual([]);
        expect(docsHeadings(await checkInput(sandbox.path, 'integrity/docs-headings', ['README.md']))).toStrictEqual(
            [],
        );
        const found = docsHeadings(await checkInput(sandbox.path, 'integrity/docs-headings', ['guide.md']));
        expect(found.map((finding) => [finding.line, finding.rule])).toStrictEqual([[5, 'banned-heading']]);
    });

    test('a list before the setup section does not supply an opening paragraph', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'README.md': '# Thing\n\n- An item.\n\n## Setup\n' });
        const found = readmeShape(await checkInput(sandbox.path, 'docs/readme-shape', ['README.md']));
        expect(found.map((finding) => finding.rule)).toStrictEqual(['opening-paragraph']);
    });
});
