import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/plan.ts';
import { testdir, createFileTree } from 'testdirs';
import { readAsset } from '#cli/platform/assets.ts';
import { vale } from '#cli/checks/general/prose.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { workspaceRoot } from '#automation/workspace.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { parseAlerts } from '#cli/parsers/output/reports.ts';
import { runBuiltInCheck } from '#cli/execution/built-in.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { PROSE_GRAMMARS } from '#cli/config/generation/prose.ts';
import { TOKEN_IGNORES } from '#cli/config/generation/templates.ts';
import { STYLE_CASES, CURRENCY_CASES } from '#tests/config/tools/vale.ts';

for (const extension of ['md', 'sh']) {
    test(`native Vale reports a ${extension} defect and accepts corrected source`, async () => {
        await using directory = await testdir();
        const path = `sample.${extension}`;
        await createFileTree(directory.path, {
            'gspot.toml': buildPolicy(['prose', 'bash', 'markdown']),
            '.gspot/config/vale.ini': 'StylesPath = styles\nMinAlertLevel = suggestion\n[*]\nBasedOnStyles = Example\n',
            '.gspot/config/styles/Example/Concrete.yml':
                'extends: existence\nmessage: "Use inspect."\nlevel: error\ntokens: [delve]\n',
            [path]: '# We delve into the records.\n',
        });
        const session = await openSession(directory.path);
        const [planned] = planRun(session, { stage: 'commit', skips: [], only: ['prose/vale'] });
        const defect = await runBuiltInCheck(vale)(session, planned!);
        expect(defect.status, defect.note).toBe('failed');
        expect(defect.findings).toStrictEqual([containing({ file: path, line: 1, rule: 'Example.Concrete' })]);
        await Bun.write(join(directory.path, path), '# We inspect the records.\n');
        const corrected = await runBuiltInCheck(vale)(session, planned!);
        expect(corrected.status, corrected.note).toBe('passed');
    });
}

test('Vale preserves ESLint delimiters while checking punctuation inside reasons and neighboring comments', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['prose', 'typescript']),
        '.gspot/config/vale.ini': 'StylesPath = styles\nMinAlertLevel = suggestion\n[*]\nBasedOnStyles = Example\n',
        '.gspot/config/styles/Example/Dashes.yml': readAsset('configurations/general/prose/styles/gspot/dashes.yml'),
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
    const defect = await runBuiltInCheck(vale)(session, planned!);
    expect(defect.status, defect.note).toBe('failed');
    expect(defect.findings).toStrictEqual([
        containing({ file: 'source.ts', line: 4, column: 56, rule: 'Example.Dashes' }),
        containing({ file: 'source.ts', line: 5, column: 15, rule: 'Example.Dashes' }),
    ]);
    await Bun.write(join(directory.path, 'source.ts'), '// Punctuation stays checked.\n');
    const corrected = await runBuiltInCheck(vale)(session, planned!);
    expect(corrected.status, corrected.note).toBe('passed');
});

test.each([
    ['ts', '//', 'const text = "delve";'],
    ['mts', '//', 'const text = "delve";'],
    ['js', '//', 'const text = "delve";'],
    ['cjs', '//', 'const text = "delve";'],
    ['py', '#', 'text = "delve"'],
    ['swift', '//', 'let text = "delve"'],
])('Vale parses Markdown in %s comments without treating source strings as prose', async (extension, marker, code) => {
    await using directory = await testdir();
    const path = `source.${extension}`;
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['prose']),
        '.gspot/config/vale.ini': [
            'StylesPath = styles',
            '[formats]',
            ...Object.entries(PROSE_GRAMMARS).flatMap(([extension, grammar]) =>
                grammar.format === undefined ? [] : [`${extension.slice(1)} = ${grammar.format}`],
            ),
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
    const result = await runBuiltInCheck(vale)(session, planned!);
    expect(result.status, result.note).toBe('failed');
    expect(result.findings).toStrictEqual([
        containing({ file: path, line: 2, rule: 'Example.Concrete' }),
        containing({ file: path, line: 5, rule: 'Example.Concrete' }),
        containing({ file: path, line: 6, rule: 'Example.Concrete' }),
    ]);
});

test('Vale accepts explicit minimum versions and still reports vague or redundant ranges', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['prose', 'markdown']),
        '.gspot/config/vale.ini': 'StylesPath = styles\nMinAlertLevel = suggestion\n[*]\nBasedOnStyles = Example\n',
        '.gspot/config/styles/Example/Versions.yml': readAsset(
            'configurations/general/prose/styles/gspot/version-range.yml',
        ),
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
    const result = await runBuiltInCheck(vale)(session, planned!);
    expect(result.status, result.note).toBe('failed');
    expect(result.findings).toStrictEqual([
        containing({ file: 'versions.md', line: 4, rule: 'Example.Versions' }),
        containing({ file: 'versions.md', line: 5, rule: 'Example.Versions' }),
        containing({ file: 'versions.md', line: 6, rule: 'Example.Versions' }),
    ]);
});

test('heading capitalization distinguishes ordinary edge from the browser name and rejects title case', async () => {
    await using directory = await testdir();
    const rule = readFileSync(
        join(workspaceRoot, 'packages/cli/configurations/general/prose/styles/gspot/heading-case.yml'),
        'utf8',
    );
    await createFileTree(directory.path, {
        'styles/gspot/heading-case.yml': rule,
        'styles/config/vocabularies/project/accept.txt': 'Bun\n',
        '.vale.ini': 'StylesPath = styles\nVocab = project\n\n[*.md]\nBasedOnStyles = gspot\n',
        'guide.md': '# Guide\n\n## HTTP edge rules\n\n## Microsoft Edge settings\n\n## HTTP Edge Rules\n',
    });
    const result = await runTestCommand(
        ['vale', '--config', '.vale.ini', '--output', 'JSON', '--no-exit', 'guide.md'],
        {
            cwd: directory.path,
        },
    );
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(parseAlerts(result.stdout).map((alert) => ({ line: alert.line, check: alert.check }))).toStrictEqual([
        { line: 7, check: 'gspot.heading-case' },
    ]);
});

test.each([...CURRENCY_CASES])(
    'Vale currency checks distinguish amounts from parameter text in $path',
    async (entry) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            '.vale.ini':
                'StylesPath = styles\nMinAlertLevel = suggestion\n[formats]\nsh = py\nts = md\n[*]\nBasedOnStyles = gspot\n',
            'styles/gspot/currency.yml': readAsset('configurations/general/prose/styles/gspot/currency.yml'),
            [entry.path]: entry.source,
        });
        const native = await runTestCommand(
            ['vale', '--config', '.vale.ini', '--output', 'JSON', '--no-exit', entry.path],
            { cwd: directory.path },
        );
        expect(native.code, native.stdout + native.stderr).toBe(0);
        expect(parseAlerts(native.stdout).map((alert) => ({ line: alert.line, check: alert.check }))).toStrictEqual(
            entry.lines.map((line) => ({ line, check: 'gspot.currency' })),
        );
    },
);

test('generated recommended Vale configuration reports unhelpful link text and accepts the destination name', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['prose'], { tables: '[agent_rules]\nenabled = false\n' }),
        'guide.md': '# Guide\n\nRead [here](guide.md).\n\n```markdown\n[here](guide.md)\n```\n',
        'source.ts': 'const example = "[here](guide.md)";\n// Read [here](guide.md).\n',
    });
    const session = await openSession(directory.path);
    using ownership = openOwnership(directory.path);
    writeOutputs(session, ownership, undefined, emitAll(session));
    const [planned] = planRun(session, { stage: 'commit', skips: [], only: ['prose/vale'] });
    const defect = await runBuiltInCheck(vale)(session, planned!);
    expect(defect.status, defect.note).toBe('failed');
    expect(defect.findings).toStrictEqual([
        containing({ file: 'guide.md', line: 3, rule: 'gspot.link-text' }),
        containing({ file: 'source.ts', line: 2, rule: 'gspot.link-text' }),
    ]);
    await Bun.write(
        join(directory.path, 'guide.md'),
        '# Guide\n\nRead [request guide](guide.md).\n\n```markdown\n[here](guide.md)\n```\n',
    );
    await Bun.write(
        join(directory.path, 'source.ts'),
        'const example = "[here](guide.md)";\n// Read [request guide](guide.md).\n',
    );
    const corrected = await runBuiltInCheck(vale)(session, planned!);
    expect(corrected.status, corrected.note).toBe('passed');
    expect(corrected.findings).toStrictEqual([]);
});

test.each([...STYLE_CASES])('Vale $rule checks report prose defects and accept source notation', async (entry) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        '.vale.ini': 'StylesPath = styles\n[formats]\nts = md\n[*]\nBasedOnStyles = gspot\n',
        [`styles/gspot/${entry.rule}.yml`]: readAsset(`configurations/general/prose/styles/gspot/${entry.rule}.yml`),
        [entry.path]: entry.source,
    });
    const native = await runTestCommand(
        ['vale', '--config', '.vale.ini', '--output', 'JSON', '--no-exit', entry.path],
        { cwd: directory.path },
    );
    expect(native.code, native.stdout + native.stderr).toBe(0);
    const alerts = parseAlerts(native.stdout);
    expect(alerts.map(({ line, check }) => ({ line, check }))).toStrictEqual(
        entry.lines.map((line) => ({ line, check: `gspot.${entry.rule}` })),
    );
    if (entry.rule === 'placeholders')
        expect(alerts.map(({ message }) => message)).toStrictEqual([
            "Placeholder style 'YOUR_TOKEN'. Use <kebab-case> in angle brackets.",
            "Placeholder style '{{token}}'. Use <kebab-case> in angle brackets.",
        ]);
});
