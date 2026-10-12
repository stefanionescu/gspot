import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { appendFile } from 'node:fs/promises';
import { TYPO } from '#tests/config/spelling.ts';
import { applyChanges } from '#tests/setup/files.ts';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { shareInstalledSandbox } from '#tests/setup/sandbox.ts';
import { TYPESCRIPT_CASES, TYPESCRIPT_SANDBOX, ARCHITECTURE_SETTINGS } from '#tests/config/typescript.ts';

const installedSandbox = shareInstalledSandbox({
    ...TYPESCRIPT_SANDBOX,
    async prepare(root, environment) {
        await appendFile(join(root, 'gspot.toml'), ARCHITECTURE_SETTINGS);
        const applied = await spawnGspot(root, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const formatted = await spawnGspot(root, ['check', '--only', 'format/prettier', '--fix'], environment);
        expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
    },
});

// typos needs an explicit option to keep exclusions for paths from the command line.
test('typos keeps its excluded paths for a file named on the command line', async () => {
    const { root, environment } = installedSandbox();
    const restore = await applyChanges(root, {
        check: 'spelling/typos',
        files: { 'assets/mark.svg': `<svg><title>${TYPO.the}</title></svg>\n` },
    });
    try {
        const excluded = await spawnGspot(
            root,
            ['check', '--only', 'spelling/typos', '--json', '--', 'assets/mark.svg'],
            environment,
        );
        expect(excluded.code, excluded.stdout + excluded.stderr).toBe(0);
        expect((JSON.parse(excluded.stdout) as RunReport).checks).toMatchObject([
            { check: 'spelling/typos', status: 'passed', fileCount: 1 },
        ]);
    } finally {
        await restore();
    }
});
for (const entry of TYPESCRIPT_CASES) {
    test(`${entry.check} reports ${entry.expected.file} and passes after the fix`, async () => {
        await runCheckSample(installedSandbox(), entry, TYPESCRIPT_SANDBOX);
    });
}
