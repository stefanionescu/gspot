import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { compareText } from '#cli/system/text.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { FLOW_SAMPLES } from '#tests/config/configurations/javascript/rule-samples.ts';
import { ESLINT_LEVEL_CASES } from '#tests/config/configurations/javascript/configuration-blocks.ts';

test.each(ESLINT_LEVEL_CASES)('%s reports each control flow sample in %s', async (level, extension) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        ...Object.fromEntries(FLOW_SAMPLES.map((sample) => [`${sample.name}.${extension}`, sample.bad])),
    });
    const eslint = await buildEslint(sandbox.path);
    const files = FLOW_SAMPLES.map((sample) => `${sample.name}.${extension}`);
    const rules = [...new Set(FLOW_SAMPLES.map((sample) => sample.rule))];
    const findings = await listLintFindings(eslint, sandbox.path, files, rules);
    const reported = findings.map(({ file, rule }) => `${file} ${String(rule)}`);
    const expected = FLOW_SAMPLES.filter((sample) => level === 'all' || sample.level === 'basic').map(
        (sample) => `${sample.name}.${extension} ${sample.rule}`,
    );
    expect([...new Set(reported)].toSorted(compareText)).toStrictEqual(expected.toSorted(compareText));
    await createFileTree(
        sandbox.path,
        Object.fromEntries(FLOW_SAMPLES.map((sample) => [`${sample.name}.${extension}`, sample.good])),
    );
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});

test.each(['basic', 'all'] as const)('%s reports implicit global checks in JavaScript', async (level) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level }),
        'package.json': '{"private":true,"type":"module"}',
        'global.js': 'export function count() { total = 1; }',
    });
    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['global.js'], ['no-undef'])).toStrictEqual([
        { file: 'global.js', rule: 'no-undef', line: 1 },
    ]);
    await createFileTree(sandbox.path, { 'global.js': 'export function count() { const total = 1; return total; }' });
    expect(await listLintFindings(eslint, sandbox.path, ['global.js'], ['no-undef'])).toStrictEqual([]);
});
