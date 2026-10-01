import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { TOKEN_IGNORES } from '#cli/config/kits.ts';
import { readAsset } from '#cli/platform/assets.ts';
import { run } from '#tests/support/cli/command.ts';
import { openSession } from '#cli/execution/session.ts';
import { valeFindings } from '#cli/checks/prose/vale.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { runEngineCheck } from '#cli/execution/engines.ts';
import { containing } from '#tests/support/expectations.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { PROSE_FORMATS } from '#cli/generation/vale-styles.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';

for (const extension of ['md', 'sh']) {
    test(`native Vale reports a ${extension} defect and accepts corrected source`, async () => {
        await using directory = await testdir();
        const path = `sample.${extension}`;
        await createFileTree(directory.path, {
            'gspot.toml': policyOf(['prose', 'bash', 'markdown']),
            '.gspot/config/vale.ini': 'StylesPath = styles\nMinAlertLevel = suggestion\n[*]\nBasedOnStyles = Example\n',
            '.gspot/config/styles/Example/Concrete.yml':
                'extends: existence\nmessage: "Use inspect."\nlevel: error\ntokens: [delve]\n',
            [path]: '# We delve into the records.\n',
        });
        const session = await openSession(directory.path);
        const [planned] = planRun(session, { stage: 'commit', skips: [], only: ['prose/vale'] });
        const defect = await runEngineCheck(session, valeFindings, planned!);
        expect(defect.status, defect.note).toBe('fail');
        expect(defect.findings).toStrictEqual([containing({ file: path, line: 1, rule: 'Example.Concrete' })]);
        await Bun.write(join(directory.path, path), '# We inspect the records.\n');
        const corrected = await runEngineCheck(session, valeFindings, planned!);
        expect(corrected.status, corrected.note).toBe('ok');
    });
}

test('Vale preserves ESLint delimiters while checking punctuation inside reasons and neighboring comments', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': policyOf(['prose', 'typescript']),
        '.gspot/config/vale.ini': 'StylesPath = styles\nMinAlertLevel = suggestion\n[*]\nBasedOnStyles = Example\n',
        '.gspot/config/styles/Example/Dashes.yml': readAsset('kits/general/prose/styles/gspot/dashes.yml'),
        'source.ts': [
            '// eslint-disable -- reason: The external declaration requires this signature.',
            '// eslint-enable no-x, @scope/no-y -- reason: Checks resume here.',
            '// eslint-disable-line no-x -- reason: The external declaration requires this signature.',
            '// eslint-disable-next-line no-x -- reason: Punctuation -- stays checked.',
            '// Punctuation -- stays checked.',
            '',
        ].join('\n'),
    });
    const session = await openSession(directory.path);
    const [planned] = planRun(session, { stage: 'commit', skips: [], only: ['prose/vale'] });
    const defect = await runEngineCheck(session, valeFindings, planned!);
    expect(defect.status, defect.note).toBe('fail');
    expect(defect.findings).toStrictEqual([
        containing({ file: 'source.ts', line: 4, column: 56, rule: 'Example.Dashes' }),
        containing({ file: 'source.ts', line: 5, column: 15, rule: 'Example.Dashes' }),
    ]);
    await Bun.write(join(directory.path, 'source.ts'), '// Punctuation stays checked.\n');
    const corrected = await runEngineCheck(session, valeFindings, planned!);
    expect(corrected.status, corrected.note).toBe('ok');
});

test.each([
    ['ts', '//', 'const text = "delve";'],
    ['tsx', '//', 'const text = "delve";'],
    ['mts', '//', 'const text = "delve";'],
    ['cts', '//', 'const text = "delve";'],
    ['js', '//', 'const text = "delve";'],
    ['jsx', '//', 'const text = "delve";'],
    ['mjs', '//', 'const text = "delve";'],
    ['cjs', '//', 'const text = "delve";'],
    ['py', '#', 'text = "delve"'],
    ['swift', '//', 'let text = "delve"'],
])('Vale parses Markdown in %s comments without treating source strings as prose', async (extension, marker, code) => {
    await using directory = await testdir();
    const path = `source.${extension}`;
    await createFileTree(directory.path, {
        'gspot.toml': policyOf(['prose']),
        '.gspot/config/vale.ini': [
            'StylesPath = styles',
            '[formats]',
            ...PROSE_FORMATS.map(([from, to]) => `${from} = ${to}`),
            '[*]',
            'BasedOnStyles = Example',
            `TokenIgnores = ${TOKEN_IGNORES.join(', ')}`,
            '',
        ].join('\n'),
        '.gspot/config/styles/Example/Concrete.yml':
            'extends: existence\nmessage: "Use inspect."\nlevel: error\ntokens: [delve]\n',
        [path]: [
            `${marker} Pass \`delve\` to the command.`,
            `${marker} We delve into records.`,
            code,
            `${marker} @param delve the command name`,
            `${marker} @param value We delve into records.`,
            `${marker} eslint-disable no-console -- reason: We delve into records.`,
            '',
        ].join('\n'),
    });
    const session = await openSession(directory.path);
    const [planned] = planRun(session, { stage: 'commit', skips: [], only: ['prose/vale'] });
    const result = await runEngineCheck(session, valeFindings, planned!);
    expect(result.status, result.note).toBe('fail');
    expect(result.findings).toStrictEqual([
        containing({ file: path, line: 2, rule: 'Example.Concrete' }),
        containing({ file: path, line: 5, rule: 'Example.Concrete' }),
        containing({ file: path, line: 6, rule: 'Example.Concrete' }),
    ]);
});

test('Vale accepts explicit minimum versions and still reports vague or redundant ranges', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': policyOf(['prose', 'markdown']),
        '.gspot/config/vale.ini': 'StylesPath = styles\nMinAlertLevel = suggestion\n[*]\nBasedOnStyles = Example\n',
        '.gspot/config/styles/Example/Versions.yml': readAsset('kits/general/prose/styles/gspot/version-range.yml'),
        'versions.md': [
            'Use Node.js 24.2.0 or later.',
            'Use Git 2.40 or newer.',
            'Use version 3 or higher.',
            'Use version 3.x.',
            'Use version 3+ or later.',
            'Use the current version or newer.',
            'Use version 1.2.0-beta.1 or later.',
            'Use version 3.2.0  or newer.',
            'Use version 3.2.0\nor later.',
            '',
        ].join('\n'),
    });
    const session = await openSession(directory.path);
    const [planned] = planRun(session, { stage: 'commit', skips: [], only: ['prose/vale'] });
    const result = await runEngineCheck(session, valeFindings, planned!);
    expect(result.status, result.note).toBe('fail');
    expect(result.findings).toStrictEqual([
        containing({ file: 'versions.md', line: 4, rule: 'Example.Versions' }),
        containing({ file: 'versions.md', line: 5, rule: 'Example.Versions' }),
        containing({ file: 'versions.md', line: 6, rule: 'Example.Versions' }),
    ]);
});

test('a raw-markup fixture exception preserves adjacent images and other prose rules', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': [
            'version = 1',
            'kits = ["prose"]',
            '[[ignore]]',
            'check = "prose/vale"',
            'rule = "Example.Alt"',
            'paths = ["fixture.ts"]',
            'reason = "The fixture deliberately omits alt text to test accessibility findings."',
            '',
        ].join('\n'),
        '.gspot/config/vale.ini': 'StylesPath = styles\n[*]\nBasedOnStyles = Example\n',
        '.gspot/config/styles/Example/Alt.yml': readAsset('kits/general/prose/styles/gspot/alt-text.yml'),
        '.gspot/config/styles/Example/Concrete.yml':
            'extends: existence\nmessage: "Use inspect."\nlevel: error\ntokens: [delve]\n',
        'fixture.ts': 'const markup = \'<img src="fixture.png">\';\n// We delve into records.\n',
        'guide.md': '<img src="example.png">\n',
    });
    const result = await run(directory.path, ['check', '--only', 'prose/vale', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = JSON.parse(result.stdout) as RunReport;
    expect(report.checks.flatMap((check) => check.findings)).toStrictEqual([
        containing({ file: 'fixture.ts', line: 2, rule: 'Example.Concrete' }),
        containing({ file: 'guide.md', line: 1, rule: 'Example.Alt' }),
    ]);
    expect(report.ignores).toContainEqual(containing({ rule: 'Example.Alt', matched: 1 }));
});
