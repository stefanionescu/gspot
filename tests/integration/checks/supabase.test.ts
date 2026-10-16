import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { installToolProjects } from '#tests/setup/install.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { shareInstalledSandbox } from '#tests/setup/sandbox.ts';
import { hasToolBuild } from '#tests/setup/operating-systems.ts';
import { SUPABASE_CASES, SUPABASE_SANDBOX } from '#tests/config/supabase.ts';

// The pinned semgrep tool has no build for some operating systems.
test.skipIf(!hasToolBuild('semgrep'))(
    'manual Supabase selection reports Deno secret logs in root and child scopes',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['supabase', 'security'], {
                level: 'all',
                tables: `[[scope]]
path = "child"

`,
            }),
            ...Object.fromEntries(
                ['supabase/functions/source.js', 'child/source.js'].map((path) => [
                    path,
                    'console.log(Deno.env.get("API_SECRET"));\n',
                ]),
            ),
        });
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installToolProjects(sandbox.path);
        const command = ['check', '--only', 'security/semgrep', '--json'];
        const failed = await spawnGspot(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const report = JSON.parse(failed.stdout) as RunReport;
        expect(
            report.checks
                .flatMap((check) => check.findings)
                .map(({ file, line, rule }) => ({ file, line, rule }))
                .toSorted((a, b) => a.file.localeCompare(b.file)),
        ).toStrictEqual(
            ['supabase/functions/source.js', 'child/source.js']
                .map((file) => ({
                    file,
                    line: 1,
                    rule: 'gspot.javascript.no-secret-in-log',
                }))
                .toSorted((a, b) => a.file.localeCompare(b.file)),
        );
        for (const path of ['supabase/functions/source.js', 'child/source.js']) {
            expect(await Bun.file(join(sandbox.path, path)).text()).toBe('console.log(Deno.env.get("API_SECRET"));\n');
            await Bun.write(join(sandbox.path, path), 'console.log("Unable to load the record");\n');
        }
        const corrected = await spawnGspot(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks.flatMap((check) => check.findings)).toStrictEqual([]);
    },
);

const installedSandbox = shareInstalledSandbox(SUPABASE_SANDBOX);

for (const entry of SUPABASE_CASES) {
    // The pinned deno tool has no build for some operating systems.
    test.skipIf(!hasToolBuild('deno'))(
        `${entry.check} reports ${entry.expected.file} and passes after the fix`,
        async () => {
            await runCheckSample(installedSandbox(), entry, SUPABASE_SANDBOX);
        },
    );
}
