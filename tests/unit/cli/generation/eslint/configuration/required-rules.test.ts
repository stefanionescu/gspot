import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { createEslint, readEslintConfiguration } from '#tests/setup/generate.ts';
import { REQUIRED_RULE_CASES, REQUIRED_RULE_FILES } from '#tests/config/eslint/lint-rules.ts';

const cases = REQUIRED_RULE_CASES.flatMap((entry) => LEVELS.map((level) => ({ ...entry, level })));

test.each(cases)(
    'the required $configuration rules for .$ending files are on at $level ($route)',
    async ({ configuration, ending, rules, level, route }) => {
        await using sandbox = await testdir();
        const path = `${route}/page.${ending}`;
        await createFileTree(sandbox.path, {
            ...REQUIRED_RULE_FILES,
            'gspot.toml': settingsText([configuration], { level }),
            [path]: '',
        });
        const eslint = await createEslint(sandbox.path);
        const configured = await readEslintConfiguration(eslint, path);
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
