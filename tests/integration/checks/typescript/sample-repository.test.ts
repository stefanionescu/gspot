import { join } from 'node:path';
import { appendFile } from 'node:fs/promises';
import { test, expect, beforeAll } from 'bun:test';
import { TYPO } from '#tests/data/checks/spelling.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/sample-checks.ts';

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

// typos needs an explicit option to keep exclusions for paths from the command line.
test('typos keeps its excluded paths for a file named on the command line', async () => {
    const { root, environment } = installedSandbox();
    await using _change = await updateSandbox(installedSandbox(), {
        check: 'spelling/typos',
        files: { 'assets/mark.svg': `<svg><title>${TYPO.the}</title></svg>\n` },
    });

    const excluded = parseCheckReport(
        await spawnGspot(root, ['check', '--only', 'spelling/typos', '--json', '--', 'assets/mark.svg'], environment),
    );

    expect(excluded.code, excluded.stdout + excluded.stderr).toBe(0);

    expect(excluded.report.checks).toMatchObject([{ check: 'spelling/typos', status: 'passed', fileCount: 1 }]);
});
test.each([...TYPESCRIPT_CASES])('$check reports $expected.file and passes after the fix', async (entry) => {
    const result = await runCheckSample(installedSandbox(), entry, TYPESCRIPT_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
});

test('the sample TypeScript repository passes every check that init selects for it', async () => {
    const { root, environment } = installedSandbox();
    const checked = await spawnGspot(root, ['check', '--json'], environment);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
});
