import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { compareText } from '#cli/system/text.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { SONAR_REGEX_SAMPLES } from '#tests/config/configurations/javascript/checks.ts';
import { ESLINT_LEVEL_CASES } from '#tests/config/configurations/javascript/configuration-blocks.ts';

test.each(ESLINT_LEVEL_CASES)(
    '%s preserves replaced Sonar regular expression checks in %s',
    async (level, extension) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
            'package.json': '{"private":true,"type":"module"}',
            ...Object.fromEntries(SONAR_REGEX_SAMPLES.map((sample) => [`${sample.name}.${extension}`, sample.bad])),
        });
        const eslint = await buildEslint(sandbox.path);
        const files = SONAR_REGEX_SAMPLES.map((sample) => `${sample.name}.${extension}`);
        const rules = [...new Set(SONAR_REGEX_SAMPLES.map((sample) => sample.rule))];
        const findings = await listLintFindings(eslint, sandbox.path, files, rules);
        const reported = findings.map(({ file, rule }) => `${file} ${String(rule)}`);
        const expected = SONAR_REGEX_SAMPLES.filter((sample) => level === 'all' || sample.level === 'basic').map(
            (sample) => `${sample.name}.${extension} ${sample.rule}`,
        );
        expect([...new Set(reported)].toSorted(compareText)).toStrictEqual(expected.toSorted(compareText));
        await createFileTree(
            sandbox.path,
            Object.fromEntries(SONAR_REGEX_SAMPLES.map((sample) => [`${sample.name}.${extension}`, sample.good])),
        );
        expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
    },
);
