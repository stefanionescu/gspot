import { relative } from 'node:path';

import { expect, test } from 'bun:test';
import type { ESLint } from 'eslint';
import { createFileTree, testdir } from 'testdirs';

import { convertToPosixPath } from '#cli/system/paths.ts';
import { BASE_SELECTOR_SAMPLES } from '#tests/config/configurations/javascript/base-selectors.ts';
import { CONFIGURATION_SELECTOR_SAMPLES } from '#tests/config/configurations/javascript/selectors.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint } from '#tests/setup/eslint/lint.ts';
import type { SelectorSample } from '#tests/types/configurations.ts';

test.each([...BASE_SELECTOR_SAMPLES, ...CONFIGURATION_SELECTOR_SAMPLES])('$name', async (sample) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(sample.configurations, {
            level: sample.level,
            ...(sample.tables !== undefined && { tables: sample.tables }),
        }),
        ...sample.files,
    });
    const eslint = await buildEslint(sandbox.path);
    expect(await listSelectorLines(eslint, sandbox.path, sample)).toStrictEqual(sample.findings);
    if (sample.corrected === undefined) return;
    await createFileTree(sandbox.path, sample.corrected);
    expect(await listSelectorLines(eslint, sandbox.path, sample)).toStrictEqual({});
});

async function listSelectorLines(
    eslint: ESLint,
    root: string,
    sample: SelectorSample,
): Promise<Record<string, readonly number[]>> {
    const results = await eslint.lintFiles(Object.keys(sample.files).filter((path) => /\.[jt]sx?$/u.test(path)));
    const lines: Record<string, readonly number[]> = {};
    for (const { filePath, messages } of results) {
        const reported = messages.filter(
            ({ ruleId, message, fatal }) =>
                fatal === true || (ruleId === 'gspot/restricted-syntax' && message.startsWith(sample.message ?? '')),
        );
        if (reported.length > 0) lines[convertToPosixPath(relative(root, filePath))] = reported.map(({ line }) => line);
    }
    return lines;
}
