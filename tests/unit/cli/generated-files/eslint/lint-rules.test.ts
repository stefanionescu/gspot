import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import type { EslintConfiguration } from '#tests/types/tool-output.ts';
import { createEslint, collectLintFindings } from '#tests/setup/tool-files.ts';

import {
    REQUIRED_RULE_CASES,
    REQUIRED_RULE_FILES,
    DUPLICATE_RULE_CASES,
    DUPLICATE_RULE_FILES,
} from '#tests/data/generated-files/eslint/lint-rules.ts';

test.each([...DUPLICATE_RULE_CASES])(
    'duplicate-rules > each pair of duplicate rules reports a defect once, from the kept rule (%j)',
    async ({ file, rules, kept }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...DUPLICATE_RULE_FILES,
            'gspot.toml': buildSettingsText(['typescript'], { level: 'all' }),
            ...Object.fromEntries(DUPLICATE_RULE_CASES.map(({ file, source }) => [file, source])),
        });
        const eslint = await createEslint(sandbox.path);

        const reports = await collectLintFindings(eslint, sandbox.path, [file], rules);
        expect(
            reports.map(({ rule }) => rule),
            file,
        ).toStrictEqual([kept]);
    },
);

test.each(['javascript', 'typescript'].flatMap((language) => [7, 8].map((maximum) => ({ language, maximum }))))(
    'parameter-limits > ESLint for $language counts declared parameters with maximum $maximum',
    async ({ language, maximum }) => {
        await using folder = await testdir();
        const extension = { javascript: 'js', typescript: 'ts' }[language]!;
        const source = [7, 8]
            .map((count) => {
                const names = Array.from({ length: count }, (_, index) => `value${String(index)}`);
                const name = count === 7 ? 'seven' : 'eight';
                const parameters =
                    language === 'typescript' ? ['this: void', ...names.map((name) => `${name}: number`)] : names;
                return `export function ${name}(${parameters.join(', ')}) { return ${names.join(' + ')}; }`;
            })
            .join('\n');
        // The shipped limit allows seven parameters; the other row changes it.
        const limits =
            maximum === 7
                ? ''
                : `[limits.${language}]\nfunction_parameters = { value = ${String(maximum)}, reason = "This sandbox tests the authored parameter ceiling." }\n`;
        await createFileTree(folder.path, {
            'gspot.toml': buildSettingsText([language], { tables: limits, level: 'all' }),
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
            [`example.${extension}`]: source,
        });
        const eslint = await createEslint(folder.path);
        const file = `example.${extension}`;
        expect(await collectLintFindings(eslint, folder.path, [file], ['max-params'])).toStrictEqual(
            maximum === 7 ? [{ file, rule: 'max-params', line: 2 }] : [],
        );
    },
);

test.each(REQUIRED_RULE_CASES.flatMap((entry) => LEVELS.map((level) => ({ ...entry, level }))))(
    'required-rules > the required $configuration rules for .$ending files are on at $level ($route)',
    async ({ configuration, ending, rules, level, route }) => {
        await using sandbox = await testdir();
        const path = `${route}/page.${ending}`;
        await createFileTree(sandbox.path, {
            ...REQUIRED_RULE_FILES,
            'gspot.toml': buildSettingsText([configuration], { level }),
            [path]: '',
        });
        const eslint = await createEslint(sandbox.path);
        const configured = (await eslint.calculateConfigForFile(path)) as EslintConfiguration;
        for (const [rule, requiredLevel] of Object.entries(rules)) {
            const enabledAtLevel = level === 'all' || requiredLevel === 'recommended';
            const appliesToRoute = rule !== '@next/next/no-html-link-for-pages' || route === 'pages';
            const entry = configured.rules[rule];
            const severity = Array.isArray(entry) ? entry[0] : entry;
            expect(severity === 1 || severity === 2, `${level}/${route}/${ending}/${rule}`).toBe(
                enabledAtLevel && appliesToRoute,
            );
        }
    },
);
