import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { inspectTool } from '#cli/tools/inspect.ts';
import { openSession } from '#cli/execution/session.ts';
import { applyAll } from '#cli/commands/apply/workflow.ts';
import { gspot as CLI } from '#tests/support/cli/command.ts';
import { configurationManifests } from '#cli/kits/manifests.ts';
import { readOwnership } from '#cli/lifecycle/ownership/owner.ts';
import { readPackageInputs, createPackageProject } from '#tests/support/cli/package-project.ts';

test('CLI installation records the native wrapper binary and reports a usable tool', async () => {
    await using fixture = await createPackageProject('npm', 'package.json', 'none');
    const { root, rootPackage } = fixture;
    await applyAll(await openSession(root));
    const { lockPath, lock, manifest } = readPackageInputs(root, 'npm');
    const installed = await run([process.execPath, CLI, 'install'], { cwd: root });
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(installed.stdout).toContain('.gspot/node_modules');
    expect(readFileSync(lockPath)).toStrictEqual(lock);
    expect(readFileSync(join(root, '.gspot/package.json'))).toStrictEqual(manifest);
    expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(rootPackage);
    const binary = readOwnership(root).files.find(
        (entry) =>
            entry.path.startsWith('.gspot/node_modules/editorconfig-checker/bin/') &&
            entry.path.endsWith('/editorconfig-checker'),
    );
    expect(binary?.installed).toBeDefined();
    const checker = configurationManifests()
        .get('formatting')!
        .tools.find((tool) => tool.name === 'ec')!;
    expect(inspectTool({ root, inspections: new Map() }, checker).state).toBe('ok');
    expect(readOwnership(root).files.find((entry) => entry.path === binary?.path)).toStrictEqual(binary);
}, 120_000);
