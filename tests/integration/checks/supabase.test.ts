import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { hasToolBuild } from '#tests/setup/system.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { runSandboxStep } from '#tests/setup/install.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildSandboxChanges } from '#tests/setup/builders.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { SUPABASE_CASES, SUPABASE_SANDBOX } from '#tests/data/checks/supabase.ts';
import { runCheckSample, expectedSummary, summarizeSample } from '#tests/setup/sample-checks.ts';

test.skipIf(!hasToolBuild('semgrep'))(
    'manual Supabase selection reports Deno secret logs in root and child scopes',
    async () => {
        const { root, environment } = installedSandbox();
        const files = {
            'gspot.toml': buildSettingsText(['supabase', 'security'], {
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
        };
        await using _sourceChange = await updateSandbox(
            installedSandbox(),
            buildSandboxChanges(SUPABASE_SANDBOX.files, files),
        );
        const applied = await spawnGspot(root, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await runSandboxStep(root, ['install'], environment, 'install');
        const command = ['check', '--only', 'security/semgrep', '--json'];
        const failed = await spawnGspot(root, command, environment);
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
            expect(await Bun.file(join(root, path)).text()).toBe('console.log(Deno.env.get("API_SECRET"));\n');
            await Bun.write(join(root, path), 'console.log("Unable to load the record");\n');
        }
        const corrected = await spawnGspot(root, command, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks.flatMap((check) => check.findings)).toStrictEqual([]);
    },
);

const installedSandbox = registerSharedSandbox(SUPABASE_SANDBOX);

test.skipIf(!hasToolBuild('deno')).each([...SUPABASE_CASES])(
    '$check reports $expected.file and passes after the fix',
    async (entry) => {
        const result = await runCheckSample(installedSandbox(), entry, SUPABASE_SANDBOX);
        expect(summarizeSample(result)).toStrictEqual(expectedSummary(entry));
    },
);
