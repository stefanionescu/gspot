import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { inspectTool } from '#cli/tools/inspect.ts';
import { readdirSync, readFileSync } from 'node:fs';
import { kitManifests } from '#cli/kits/manifests.ts';
import { writeOutputs } from '#cli/lifecycle/write.ts';
import { openSession } from '#cli/execution/session.ts';
import { gspot as CLI } from '#tests/harness/cli/command.ts';
import { readOwnership } from '#cli/lifecycle/ownership/owner.ts';
import { readPackageInputs, createPackageProject } from '#tests/harness/tools/npm.ts';

test('CLI installation records the npm tools as one install with the native wrapper binary, and reports a usable tool', async () => {
    await using fixture = await createPackageProject('npm', 'package.json', 'none');
    const { root, rootPackage } = fixture;
    await writeOutputs(await openSession(root));
    const { lockPath, lock, manifest } = readPackageInputs(root, 'npm');
    const installed = await run([process.execPath, CLI, 'install'], { cwd: root });
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(installed.stdout).toContain('.gspot/node_modules');
    expect(readFileSync(lockPath)).toStrictEqual(lock);
    expect(readFileSync(join(root, '.gspot/package.json'))).toStrictEqual(manifest);
    expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(rootPackage);
    expect(readOwnership(root).installs).toStrictEqual(['npm']);
    const binaries = readdirSync(join(root, '.gspot/node_modules/editorconfig-checker/bin'), {
        encoding: 'utf8',
        recursive: true,
    });
    expect(binaries.some((path) => /(?:^|[/\\])editorconfig-checker(?:\.exe)?$/u.test(path))).toBe(true);
    const checker = kitManifests()
        .get('formatting')!
        .tools.find((tool) => tool.name === 'ec')!;
    expect(inspectTool({ root, inspections: new Map() }, checker).state).toBe('ok');
}, 120_000);
