import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { SUPPRESSION_REASON_CASES, SUPPRESSION_REASONS } from '#tests/config/configurations/gspot/suppressions.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([...SUPPRESSION_REASONS])(
    'the $configuration suppression $bare needs a reason and passes with one',
    async ({ configuration, file, bare, explained, rule }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([configuration], { level: 'all' }),
            [file]: `${bare}\n${explained}\n`,
        });
        const findings = await runSandboxCheck(sandbox.path, 'gspot/suppressions');
        expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([{ file, line: 1, rule }]);
    },
);

test.each([...SUPPRESSION_REASON_CASES])('$name', async ({ path, source, findings }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'bash'], { level: 'all', rules: true }),
        [path]: source,
    });
    const found = await runSandboxCheck(sandbox.path, 'gspot/suppressions');
    expect(found.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual(
        findings.map((finding) => ({ file: path, ...finding })),
    );
});

test.each(['-->', '--!>'])('an HTML suppression that ends with %s still needs a reason', async (ending) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['html', 'structure'], { level: 'all', rules: true }),
        'page.html': `<!-- html-validate-disable attr -- External validator owns this attribute. ${ending}\n<!-- html-validate-disable attr ${ending}\n`,
    });
    const findings = await runSandboxCheck(sandbox.path, 'gspot/suppressions');
    expect(findings.map(({ file, line }) => ({ file, line }))).toStrictEqual([{ file: 'page.html', line: 2 }]);
});

test('a nosemgrep comment is reported even with a reason', async () => {
    const path = 'source.ts';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'security'], { level: 'all' }),
        [path]: '// nosemgrep: example.rule -- The external interface requires this call.\nconst value = 1;\n',
    });
    const failed = await runSandboxCheck(sandbox.path, 'gspot/suppressions');
    expect(failed.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: path, line: 1, rule: 'semgrep' },
    ]);
    await writeFile(join(sandbox.path, path), 'const value = 1;\n');
    expect(await runSandboxCheck(sandbox.path, 'gspot/suppressions')).toStrictEqual([]);
});

test('a reason in a suppression or in gspot.toml that a reader cannot look up is reported', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            ignore: { checks: ['javascript/eslint'], reason: 'Step 3.1 of the plan keeps this.' },
        }),
        'source.ts':
            '// eslint-disable-next-line no-console -- Read /Users/ada/notes.md for the reason.\nconsole.log(1);\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'gspot/suppressions');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'source.ts', rule: 'home-path' },
        { file: 'gspot.toml', rule: 'plan-step' },
    ]);
});
