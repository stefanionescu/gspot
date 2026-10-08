import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { readAsset } from '#cli/platform/root/public.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { TOKEN_IGNORES } from '#cli/config/generation/eta.ts';
import { runBuiltInCheck } from '#cli/execution/contracts.ts';
import { parseAlerts } from '#cli/parsers/output/contracts.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { PROSE_GRAMMARS } from '#cli/config/generation/prose.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { eta, etaInputs } from '#cli/generation/compilation/public.ts';
import { STYLE_CASES, CURRENCY_CASES } from '#tests/config/tools/configurations/general/prose/vale.ts';
import { VALE_INI, CONCRETE_RULE } from '#tests/config/tools/configurations/general/prose/emission.ts';

for (const extension of ['md', 'sh']) {
    test(`native Vale reports its ${extension} finding and passes after the fix`, async () => {
        await using directory = await testdir();
        const path = `sample.${extension}`;
        await createFileTree(directory.path, {
            'gspot.toml': buildPolicy(['prose', 'bash', 'markdown']),
            '.gspot/config/vale.ini': VALE_INI,
            '.gspot/config/styles/Example/Concrete.yml': CONCRETE_RULE,
            [path]: '# We delve into the records.\n',
        });
        const session = await openSession(directory.path);
        const [planned] = planRun(session, { stage: 'commit', skips: [], only: ['prose/vale'] });
        const failed = await runBuiltInCheck(BUILT_IN_CHECKS['prose/vale'].input)(session, planned!);
        expect(failed.status, failed.note).toBe('failed');
        expect(failed.findings).toStrictEqual([containing({ file: path, line: 1, rule: 'Example.Concrete' })]);
        await Bun.write(join(directory.path, path), '# We inspect the records.\n');
        const corrected = await runBuiltInCheck(BUILT_IN_CHECKS['prose/vale'].input)(session, planned!);
        expect(corrected.status, corrected.note).toBe('passed');
    });
}

test('Vale preserves ESLint delimiters while checking punctuation inside reasons and neighboring comments', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['prose', 'typescript']),
        '.gspot/config/vale.ini': VALE_INI,
        '.gspot/config/styles/Example/Dashes.yml': readAsset(
            'configurations/general/prose/styles/gspot/dashes.yml.eta',
        ),
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
    const failed = await runBuiltInCheck(BUILT_IN_CHECKS['prose/vale'].input)(session, planned!);
    expect(failed.status, failed.note).toBe('failed');
    expect(failed.findings).toStrictEqual([
        containing({ file: 'source.ts', line: 4, column: 56, rule: 'Example.Dashes' }),
        containing({ file: 'source.ts', line: 5, column: 15, rule: 'Example.Dashes' }),
    ]);
    await Bun.write(join(directory.path, 'source.ts'), '// Punctuation stays checked.\n');
    const corrected = await runBuiltInCheck(BUILT_IN_CHECKS['prose/vale'].input)(session, planned!);
    expect(corrected.status, corrected.note).toBe('passed');
});

test.each([
    ['ts', '//', 'const text = "delve";'],
    ['mts', '//', 'const text = "delve";'],
    ['py', '#', 'text = "delve"'],
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
        '.gspot/config/styles/Example/Concrete.yml': CONCRETE_RULE,
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
    const result = await runBuiltInCheck(BUILT_IN_CHECKS['prose/vale'].input)(session, planned!);
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
        '.gspot/config/vale.ini': VALE_INI,
        '.gspot/config/styles/Example/Versions.yml': readAsset(
            'configurations/general/prose/styles/gspot/version-range.yml.eta',
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
    const result = await runBuiltInCheck(BUILT_IN_CHECKS['prose/vale'].input)(session, planned!);
    expect(result.status, result.note).toBe('failed');
    expect(result.findings).toStrictEqual([
        containing({ file: 'versions.md', line: 4, rule: 'Example.Versions' }),
        containing({ file: 'versions.md', line: 5, rule: 'Example.Versions' }),
        containing({ file: 'versions.md', line: 6, rule: 'Example.Versions' }),
    ]);
});

test('heading capitalization distinguishes ordinary edge from the browser name and rejects title case', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['prose']),
        'guide.md': '# Guide\n\n## HTTP edge rules\n\n## Microsoft Edge settings\n\n## HTTP Edge Rules\n',
    });
    const session = await openSession(directory.path);
    const selection = session.scopes[0]!;
    const rule = eta.renderString(
        readAsset('configurations/general/prose/styles/gspot/heading-case.yml.eta'),
        etaInputs(session, selection, selection.selected),
    );
    await createFileTree(directory.path, {
        'styles/gspot/heading-case.yml': rule,
        '.vale.ini': 'StylesPath = styles\n\n[*.md]\nBasedOnStyles = gspot\n',
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
            'styles/gspot/currency.yml': readAsset('configurations/general/prose/styles/gspot/currency.yml.eta'),
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
    writeGeneratedFiles(session, emitAll(session), ownership);
    const [planned] = planRun(session, { stage: 'commit', skips: [], only: ['prose/vale'] });
    const failed = await runBuiltInCheck(BUILT_IN_CHECKS['prose/vale'].input)(session, planned!);
    expect(failed.status, failed.note).toBe('failed');
    expect(failed.findings).toStrictEqual([
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
    const corrected = await runBuiltInCheck(BUILT_IN_CHECKS['prose/vale'].input)(session, planned!);
    expect(corrected.status, corrected.note).toBe('passed');
    expect(corrected.findings).toStrictEqual([]);
});

test.each([...STYLE_CASES])('Vale $rule checks report prose findings and accept source notation', async (entry) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        '.vale.ini': 'StylesPath = styles\n[formats]\nts = md\n[*]\nBasedOnStyles = gspot\n',
        [`styles/gspot/${entry.rule}.yml`]: readAsset(
            `configurations/general/prose/styles/gspot/${entry.rule}.yml.eta`,
        ),
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

test.each([
    ['mts', '//', 'const text = "delve";'],
    ['cts', '//', 'const text = "delve";'],
    ['mjs', '//', 'const text = "delve";'],
    ['cjs', '//', 'const text = "delve";'],
    ['', '#', 'text = "delve"'],
])('Vale retains the grammar and scope paths for %s stdin', async (extension, marker, code) => {
    await using directory = await testdir();
    const path = extension === '' ? 'source' : `source.${extension}`;
    const prefix = extension === '' ? '#!/usr/bin/env bash\n' : '';
    const source = `${prefix}${marker} We delve into records.\n${code}\n`;
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['prose', 'bash']),
        '.gspot/config/vale.ini': `${VALE_INI}[british/**]\nExample.Concrete = NO\n`,
        '.gspot/config/styles/Example/Concrete.yml': CONCRETE_RULE,
        [path]: source,
        [`british/${path}`]: source,
    });
    const session = await openSession(directory.path);
    const [planned] = planRun(session, { stage: 'commit', skips: [], only: ['prose/vale'] });
    const result = await runBuiltInCheck(BUILT_IN_CHECKS['prose/vale'].input)(session, planned!);
    expect(result.status, result.note).toBe('failed');
    expect(result.findings).toStrictEqual([
        containing({
            file: path,
            line: extension === '' ? 2 : 1,
            column: marker === '//' ? 7 : 6,
            rule: 'Example.Concrete',
        }),
    ]);
    await Bun.write(join(directory.path, path), `${prefix}${marker} We inspect records.\n${code}\n`);
    const corrected = await runBuiltInCheck(BUILT_IN_CHECKS['prose/vale'].input)(
        await openSession(directory.path),
        planned!,
    );
    expect(corrected.status, corrected.note).toBe('passed');
    expect(await Bun.file(join(directory.path, 'british', path)).text()).toBe(source);
});
