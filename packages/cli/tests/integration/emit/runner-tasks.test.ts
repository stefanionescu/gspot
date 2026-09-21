import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { presetManifests } from '#cli/presets/read-manifests.ts';
import { MISE_MIN_VERSION, miseTasks, pinnedTwice } from '#cli/emit/runner-tasks.ts';
import { environmentVariables } from '#cli/platform/environment.ts';

test('duplicate pins include only parsed tool keys', async () => {
    await using directory = await testdir();
    const manifests = [...presetManifests().values()];
    await createFileTree(directory.path, {
        'mise.toml': `[tools]\n'shellcheck' = { version = "0.11.0" }\n"ty\\u0070os" = "1.43.5"\n[env]\nruff = "not a pin"\n[tasks]\nactionlint = "echo not a pin"\n[tasks.check]\nrun = "echo vale = something"\n`,
    });
    expect(
        pinnedTwice(directory.path, manifests)
            .map(({ tool }) => tool)
            .toSorted((left, right) => left.localeCompare(right)),
    ).toEqual(['shellcheck', 'typos']);
    writeFileSync(
        join(directory.path, 'mise.toml'),
        '[env]\ntypos = "example"\n[tasks]\nshellcheck = "echo example"\n',
    );
    expect(pinnedTwice(directory.path, manifests)).toEqual([]);
    writeFileSync(join(directory.path, 'mise.toml'), '[tools\n');
    expect(() => pinnedTwice(directory.path, manifests)).toThrow();
});

test('mise gives the root task precedence and forwards arguments unchanged', async () => {
    await using directory = await testdir();
    const generated = miseTasks([], '0.1.0', false);
    await createFileTree(directory.path, {
        [generated.path]: generated.content,
        'mise.toml': `min_version = "${MISE_MIN_VERSION}"\n[tasks."gspot:check"]\nrun = '${process.execPath} capture.ts'\n`,
        'capture.ts': 'console.log(JSON.stringify(process.argv.slice(2)));\n',
    });
    const discovered = Bun.spawnSync(['mise', 'tasks', '--json'], {
        cwd: directory.path,
        env: { ...environmentVariables(), MISE_TRUSTED_CONFIG_PATHS: directory.path },
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 10_000,
    });
    expect(discovered.exitCode, discovered.stderr.toString()).toBe(0);
    const tasks = JSON.parse(discovered.stdout.toString()) as { name: string; source: string }[];
    expect(tasks.find((task) => task.name === 'gspot:fix')?.source).toBe(join(directory.path, generated.path));
    const result = Bun.spawnSync(['mise', 'run', 'gspot:check', '--', '--json', 'a b', 'café%'], {
        cwd: directory.path,
        env: { ...environmentVariables(), MISE_TRUSTED_CONFIG_PATHS: directory.path },
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 10_000,
    });
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    expect(JSON.parse(result.stdout.toString())).toEqual(['--json', 'a b', 'café%']);
});
