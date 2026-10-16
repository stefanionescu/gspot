import { join } from 'node:path';
import { appendFile } from 'node:fs/promises';
import { test, expect, beforeAll } from 'bun:test';
import { TYPO } from '#tests/data/checks/spelling.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { runCheckSample, expectedSummary, summarizeSample } from '#tests/setup/sample-checks.ts';

import {
    TYPESCRIPT_CASES,
    TYPESCRIPT_SANDBOX,
    ARCHITECTURE_SETTINGS,
} from '#tests/data/checks/typescript/sample-repository.ts';

const installedSandbox = registerSharedSandbox(TYPESCRIPT_SANDBOX);

beforeAll(async () => {
    const { root, environment } = installedSandbox();
    await appendFile(join(root, 'gspot.toml'), ARCHITECTURE_SETTINGS);
    const applied = await spawnGspot(root, ['apply'], environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const formatted = await spawnGspot(root, ['check', '--only', 'format/prettier', '--fix'], environment);
    expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
});

test('the TypeScript ESLint fix preview completes without changing source files', async () => {
    const { root, environment } = installedSandbox();
    const source = join(root, 'src/main.ts');
    const before = await Bun.file(source).text();
    const preview = await spawnGspot(
        root,
        ['check', '--fix', '--dry-run', '--only', 'javascript/eslint', '--json'],
        environment,
    );
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect((JSON.parse(preview.stdout) as RunReport).checks).toMatchObject([
        { check: 'javascript/eslint', status: 'passed' },
    ]);
    expect(await Bun.file(source).text()).toBe(before);
});

// typos needs an explicit option to keep exclusions for paths from the command line.
test('typos keeps its excluded paths for a file named on the command line', async () => {
    const { root, environment } = installedSandbox();
    await using _change = await updateSandbox(
        { root, environment: {}, run: spawnGspot },
        {
            check: 'spelling/typos',
            files: { 'assets/mark.svg': `<svg><title>${TYPO.the}</title></svg>\n` },
        },
    );

    const excluded = await spawnGspot(
        root,
        ['check', '--only', 'spelling/typos', '--json', '--', 'assets/mark.svg'],
        environment,
    );

    expect(excluded.code, excluded.stdout + excluded.stderr).toBe(0);

    expect((JSON.parse(excluded.stdout) as RunReport).checks).toMatchObject([
        { check: 'spelling/typos', status: 'passed', fileCount: 1 },
    ]);
});
for (const entry of TYPESCRIPT_CASES) {
    test(`${entry.check} reports ${entry.expected.file} and passes after the fix`, async () => {
        const result = await runCheckSample(installedSandbox(), entry, TYPESCRIPT_SANDBOX);
        expect(summarizeSample(result)).toStrictEqual(expectedSummary(entry));
    });
}
