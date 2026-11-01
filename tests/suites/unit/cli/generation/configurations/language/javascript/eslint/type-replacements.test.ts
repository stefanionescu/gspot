import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { compareText } from '#cli/system/text.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { SONAR_TYPE_SAMPLES } from '#tests/config/generation/configurations/language/javascript/eslint/replacements.ts';

test.each(['basic', 'all'] as const)('%s preserves replaced Sonar type checks in TypeScript', async (level) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], { level }),
        'tsconfig.json':
            '{"compilerOptions":{"strict":true,"target":"esnext","lib":["esnext","dom"]},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        ...Object.fromEntries(SONAR_TYPE_SAMPLES.map((sample) => [`${sample.name}.ts`, sample.bad])),
    });
    const eslint = await buildEslint(sandbox.path);
    const files = SONAR_TYPE_SAMPLES.map((sample) => `${sample.name}.ts`);
    const rules = SONAR_TYPE_SAMPLES.map((sample) => sample.rule);
    const findings = await listLintFindings(eslint, sandbox.path, files, rules);
    const reported = findings.map(({ file, rule }) => `${file} ${String(rule)}`);
    const expected = SONAR_TYPE_SAMPLES.filter((sample) => level === 'all' || sample.level === 'basic').map(
        (sample) => `${sample.name}.ts ${sample.rule}`,
    );
    expect([...new Set(reported)].toSorted(compareText)).toStrictEqual(expected.toSorted(compareText));
    await createFileTree(
        sandbox.path,
        Object.fromEntries(SONAR_TYPE_SAMPLES.map((sample) => [`${sample.name}.ts`, sample.good])),
    );
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});
