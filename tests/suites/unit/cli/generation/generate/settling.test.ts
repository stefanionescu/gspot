import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { TOOL_LOCKFILES } from '#cli/config/files/gspot.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { type DryRunJson } from '#cli/types/commands/apply.ts';
import { type ApplyReport } from '#cli/types/generation/files.ts';
import { readTree, isOnDisk } from '#tests/setup/system/files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { GROUP_CASES, LEVEL_CASES, SWITCH_CASES, PROJECT_FILES } from '#tests/config/generation/settling.ts';

test.each(GROUP_CASES.flatMap((group) => LEVEL_CASES.map((level) => ({ group, level }))))(
    '$group configurations at level $level settle in one apply',
    async ({ group, level }) => {
        const names = readConfigurations()
            .values()
            .filter((configuration) => configuration.group === group && !configuration.always_selected)
            .map(({ name }) => name)
            .toArray();
        expect(names.length).toBeGreaterThan(0);
        await using sandbox = await createGitSandbox({
            ...PROJECT_FILES,
            'gspot.toml': buildSandboxSettings(names, { level, rules: true }),
        });
        const first = await runGspot(sandbox.path, ['apply', '--json']);
        expect(first.code, first.stdout + first.stderr).toBe(0);
        expect((JSON.parse(first.stdout) as ApplyReport).written.length).toBeGreaterThan(0);
        const before = await readTree(sandbox.path);
        const preview = await runGspot(sandbox.path, ['apply', '--dry-run', '--json']);
        expect(preview.code, preview.stdout + preview.stderr).toBe(0);
        expect(
            (JSON.parse(preview.stdout) as DryRunJson).outdated.filter(({ path }) => !TOOL_LOCKFILES.has(path)),
        ).toStrictEqual([]);
        const repeated = await runGspot(sandbox.path, ['apply', '--json']);
        expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
        expect(JSON.parse(repeated.stdout) as ApplyReport).toMatchObject({ written: [], updated: [], removed: [] });
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    },
);

test.each(SWITCH_CASES)('turning $name on and off settles in one apply', async ({ name, path }) => {
    await using sandbox = await createGitSandbox({ 'source.js': PROJECT_FILES['source.js'] });
    for (const enabled of [true, false]) {
        await writeFile(
            join(sandbox.path, 'gspot.toml'),
            buildSandboxSettings(['javascript'], {
                tables: `[${name}]\nenabled = ${String(enabled)}\n${name === 'ci' ? 'provider = "github"\n' : ''}`,
            }),
        );
        const applied = await runGspot(sandbox.path, ['apply', '--json']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        expect(await isOnDisk(join(sandbox.path, path))).toBe(enabled);
        const before = await readTree(sandbox.path);
        const preview = await runGspot(sandbox.path, ['apply', '--dry-run', '--json']);
        expect(preview.code, preview.stdout + preview.stderr).toBe(0);
        expect(
            (JSON.parse(preview.stdout) as DryRunJson).outdated.filter(
                ({ path: outdated }) => !TOOL_LOCKFILES.has(outdated),
            ),
        ).toStrictEqual([]);
        const repeated = await runGspot(sandbox.path, ['apply', '--json']);
        expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
        expect(JSON.parse(repeated.stdout) as ApplyReport).toMatchObject({ written: [], updated: [], removed: [] });
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    }
});
