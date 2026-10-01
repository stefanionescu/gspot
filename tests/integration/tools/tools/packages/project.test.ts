import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { inspectTool } from '#cli/tools/inspect.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { computeDrift } from '#cli/lifecycle/drift.ts';
import { openSession } from '#cli/execution/session.ts';
import { applyAll } from '#cli/commands/apply/workflow.ts';
import { installPackageProject } from '#cli/tools/packages/project.ts';
import { setEnvironmentVariable } from '#tests/support/environment.ts';
import { statSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { PACKAGE_PROJECTS } from '#tests/inputs/integration/tools/packages.ts';
import { readPackageInputs, createPackageProject } from '#tests/support/cli/package-project.ts';

test.each(PACKAGE_PROJECTS)(
    '%s from %s with %s preserves authored and locked inputs and restores edited tool files',
    async (client, projectPath, runner) => {
        await using fixture = await createPackageProject(client, projectPath, runner);
        const { root, artifacts, registry, rootPackage, yarnConfiguration } = fixture;
        const tools = [...kitManifests().values()].flatMap((manifest) => manifest.tools);
        const first = await applyAll(await openSession(root));
        expect(first.notes.filter((note) => note.startsWith('preserved'))).toStrictEqual([]);
        const { manifest, lockPath, lock, mode } = readPackageInputs(root, client);
        setEnvironmentVariable('YARN_CACHE_FOLDER', join(artifacts, 'installation-cache'));
        setEnvironmentVariable('YARN_GLOBAL_FOLDER', join(artifacts, 'installation-global'));
        const beforeInstall = registry.requests;
        const installed = await installPackageProject(root, tools);
        expect(installed).toContain('.gspot/node_modules');
        expect(registry.requests).toBeGreaterThan(client === 'yarn' ? beforeInstall : 0);
        const workspace = join(root, 'pnpm-workspace.yaml');
        const yarnrc = join(root, '.yarnrc.yml');
        expect({
            authored: readFileSync(join(root, projectPath), 'utf8'),
            workspace: existsSync(workspace) ? readFileSync(workspace, 'utf8') : undefined,
            yarnrc: existsSync(yarnrc) ? readFileSync(yarnrc, 'utf8') : undefined,
            dependencies: readFileSync(join(root, 'node_modules/authored.txt'), 'utf8'),
            lock: readFileSync(lockPath),
            mode: statSync(lockPath).mode,
            manifest: readFileSync(join(root, '.gspot/package.json')),
        }).toStrictEqual({
            authored: rootPackage,
            workspace: projectPath === 'package.json' ? 'packages:\n  - "**"\n' : undefined,
            yarnrc: yarnConfiguration,
            dependencies: 'keep project dependencies',
            lock,
            mode,
            manifest,
        });
        // A reinstall replaces an edited installed file with the locked one, and the tool stays ready.
        const readmePath = join(root, '.gspot/node_modules/prettier/README.md');
        const readme = readFileSync(readmePath);
        writeFileSync(readmePath, 'authored later');
        await installPackageProject(root, tools);
        expect(readFileSync(readmePath)).toStrictEqual(readme);
        const prettier = tools.find((tool) => tool.name === 'prettier')!;
        expect(inspectTool({ root, inspections: new Map() }, prettier).state).toBe('ok');
        const session = await openSession(root);
        expect(
            computeDrift(
                root,
                session.policyFiles.policy,
                emitAll(session.policyFiles.policy, session.repository, session.scopes, {
                    version: session.version,
                    packageClient: session.packageClient,
                }),
            ),
        ).toStrictEqual([]);
        const second = await applyAll(await openSession(root));
        expect(second.written).toStrictEqual([]);
        expect(readFileSync(lockPath)).toStrictEqual(lock);
    },
    120_000,
);
