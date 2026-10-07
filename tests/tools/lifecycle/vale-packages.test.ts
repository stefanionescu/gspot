import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { toolPin } from '#cli/configurations/pins.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { rootView } from '#cli/policy/settings/view.ts';
import { applyPlan } from '#cli/lifecycle/ownership/commit.ts';
import { proposeReplacement } from '#cli/lifecycle/ownership/plans.ts';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { getOwnership, openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { INSTALLED, ENCODED_ARCHIVE } from '#tests/config/tools/lifecycle/vale-packages.ts';
import { hasValePackages, removeValePackages, installValePackages } from '#cli/tools/vale.ts';

async function expectPublishedRules(root: string): Promise<void> {
    await using clone = await testdir();
    await createFileTree(clone.path, {
        'gspot.toml': buildPolicy(['prose']),
        '.gspot/config/vale.ini': readFileSync(join(root, '.gspot/config/vale.ini'), 'utf8'),
        [INSTALLED]: 'cloned bytes\n',
    });
    const session = await openSession(clone.path);
    expect(
        await installValePackages({
            search: session,
            tool: toolPin(session.manifests.values(), 'vale'),
            timeoutSeconds: Number(rootView(session.scopes).settings['tool_timeout_seconds']),
        }),
    ).toBeUndefined();
    expect(readFileSync(join(clone.path, INSTALLED))).toStrictEqual(readFileSync(join(root, INSTALLED)));
}

async function expectPrunedRules(root: string): Promise<void> {
    await createFileTree(root, { '.gspot/config/vale/styles/Retired/terms.yml': 'old rule\n' });
    const session = await openSession(root);
    expect(
        await installValePackages({
            search: session,
            tool: toolPin(session.manifests.values(), 'vale'),
            timeoutSeconds: Number(rootView(session.scopes).settings['tool_timeout_seconds']),
        }),
    ).toBeUndefined();
    expect(existsSync(join(root, '.gspot/config/vale/styles/Retired'))).toBe(false);
    expect(existsSync(join(root, INSTALLED))).toBe(true);
    removeValePackages(root);
    expect(existsSync(join(root, '.gspot/config/vale/styles/LocalStyle'))).toBe(false);
    expect(readFileSync(join(root, 'authored.txt'), 'utf8')).toBe('keep\n');
}

async function expectEditedRules(root: string): Promise<void> {
    const synced = readFileSync(join(root, INSTALLED));
    chmodSync(join(root, INSTALLED), 0o644);
    writeFileSync(join(root, INSTALLED), 'edited\n');
    const session = await openSession(root);
    expect(
        await installValePackages({
            search: session,
            tool: toolPin(session.manifests.values(), 'vale'),
            timeoutSeconds: Number(rootView(session.scopes).settings['tool_timeout_seconds']),
        }),
    ).toBeUndefined();
    expect(readFileSync(join(root, INSTALLED))).toStrictEqual(synced);
    expect(readFileSync(join(root, 'authored.txt'), 'utf8')).toBe('keep\n');
}

test.each([
    { name: 'replaces cloned bytes with the published package', verify: expectPublishedRules },
    { name: 'deletes a package the configuration no longer names', verify: expectPrunedRules },
    { name: 'replaces an edited package and leaves authored files', verify: expectEditedRules },
])(
    'Vale package sync $name',
    async ({ verify }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': buildPolicy(['prose']),
            'guide.md': 'An ambiguousword.\n',
            'authored.txt': 'keep\n',
        });
        const server = Bun.serve({
            hostname: '127.0.0.1',
            port: 0,
            fetch: () => new Response(Buffer.from(ENCODED_ARCHIVE, 'base64')),
        });
        try {
            {
                using log = openOwnership(directory.path);

                applyPlan(
                    log,
                    proposeReplacement(log, {
                        path: '.gspot/config/vale.ini',
                        next: {
                            bytes: Buffer.from(
                                `StylesPath = vale/styles\nPackages = http://127.0.0.1:${String(server.port)}/LocalStyle.zip\n\n[*]\nBasedOnStyles = LocalStyle\n`,
                            ),
                            mode: 0o444,
                        },
                        kind: 'config',
                    }),
                );
            }
            const session = await openSession(directory.path);
            expect(
                await installValePackages({
                    search: session,
                    tool: toolPin(session.manifests.values(), 'vale'),
                    timeoutSeconds: Number(rootView(session.scopes).settings['tool_timeout_seconds']),
                }),
            ).toBeUndefined();
            expect(hasValePackages(directory.path)).toBe(true);
            expect(getOwnership(directory.path).files.map((file) => file.path)).toStrictEqual([
                '.gspot/config/vale.ini',
            ]);
            await verify(directory.path);
        } finally {
            await server.stop(true);
        }
    },
    60_000,
);
