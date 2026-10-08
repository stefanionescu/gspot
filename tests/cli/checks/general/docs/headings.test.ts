import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { SETEXT_README, MISSING_SECTIONS_README } from '#tests/config/samples/docs.ts';

test('ordinary README headings do not produce banned-heading findings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['docs'], { level: 'all' }),
        'README.md': MISSING_SECTIONS_README,
    });
    const lines = BUILT_IN_CHECKS['docs/headings']
        .input(buildCheckInput(await openSession(sandbox.path), 'docs/headings', { paths: ['README.md'] }))
        .map((finding) => finding.line);
    expect(lines).toStrictEqual([]);
});

test('setext and formatted headings count, while fenced headings do not', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['docs'], { level: 'all' }),
        'README.md': SETEXT_README,
        'guide.md': '~~~md\n# Project structure\n~~~\n\n**Project structure**\n---------------------\n',
    });
    expect(
        BUILT_IN_CHECKS['docs/headings'].input(
            buildCheckInput(await openSession(sandbox.path), 'docs/headings', { paths: ['README.md'] }),
        ),
    ).toStrictEqual([]);
    const found = BUILT_IN_CHECKS['docs/headings'].input(
        buildCheckInput(await openSession(sandbox.path), 'docs/headings', { paths: ['guide.md'] }),
    );
    expect(found.map((finding) => [finding.line, finding.rule])).toStrictEqual([[5, 'banned-heading']]);
});
