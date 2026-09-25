import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { runBlocking } from '#cli/platform/spawn.ts';
import { exportedProfile } from '#cli/policy/profiles/export.ts';
import { initCommand } from '#cli/commands/init/command.ts';
import { applyUninstall, planUninstall } from '#cli/commands/uninstall.ts';

test('profile tool settings survive adoption of another setting for the same tool', async () => {
    await using directory = await testdir();
    const original = '[default]\nlocale = "en-gb"\n';
    const profile = exportedProfile(
        stringify({
            version: 1,
            configurations: ['spelling'],
            tools: { typos: { words: [{ word: 'teh', reason: 'A domain term used by the team.' }] } },
        }),
        'team.profile.toml',
    );
    await createFileTree(directory.path, {
        'team.profile.toml': profile.text,
        'typos.toml': original,
        'sample.txt': 'colour teh\n',
    });
    const options = {
        cwd: directory.path,
        from: 'team.profile.toml',
        yes: true,
        json: true,
        hooks: 'none',
        ci: 'none',
        runner: 'none',
        rules: 'no',
        install: false,
        allowDirty: false,
    } as const;
    expect((await initCommand({ ...options, isDryRun: true })).exitCode).toBe(0);
    expect(readFileSync(join(directory.path, 'typos.toml'), 'utf8')).toBe(original);
    expect((await initCommand({ ...options, isDryRun: false })).exitCode).toBe(0);
    const check = () =>
        runBlocking(['typos', '--isolated', '--config', '.gspot/config/typos.toml', 'sample.txt'], {
            cwd: directory.path,
        });
    const accepted = check();
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    await Bun.write(join(directory.path, 'sample.txt'), 'colour teh wrod\n');
    const defect = check();
    expect(defect.code).toBe(2);
    expect(defect.stdout).toContain('wrod');
    await Bun.write(join(directory.path, 'sample.txt'), 'colour teh word\n');
    expect(check().code).toBe(0);
    applyUninstall(directory.path, planUninstall(directory.path));
    expect(readFileSync(join(directory.path, 'typos.toml'), 'utf8')).toBe(original);
});
