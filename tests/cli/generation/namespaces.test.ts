import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { join, posix } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { BUILT_IN_CALCULATIONS } from '#cli/checks/public.ts';
import { targetInScope } from '#cli/configurations/contracts.ts';
import { sourceConfigurations } from '#cli/configurations/public.ts';
import { detectConfigurations } from '#cli/repository/selection/contracts.ts';
import { CONFIGURATION_NAMESPACES } from '#tests/config/cli/generation/namespaces.ts';

const namespaceCases = CONFIGURATION_NAMESPACES.flatMap((entry) =>
    ['recommended', 'all'].flatMap((level) => ['', 'app'].map((scope) => ({ ...entry, level, scope }))),
);

// Both native cases create the selected project and its explicitly excluded siblings.
async function namespaceSession(path: string, entry: (typeof namespaceCases)[number]) {
    const configurations = ['javascript', entry.name];
    const selected = {
        configurations,
        ...(entry.name === 'translations' ? { translations: { messages_folder: 'messages' } } : {}),
    };
    await createFileTree(path, {
        'gspot.toml': stringify({
            level: entry.level,
            ...(entry.scope === '' ? selected : { configurations: [] }),
            scope: {
                app: entry.scope === '' ? { removed_configurations: configurations } : selected,
                sibling: { removed_configurations: configurations },
            },
        }),
        ...Object.fromEntries(Object.entries(entry.files).map(([path, text]) => [join(entry.scope, path), text])),
        'sibling/site.webmanifest': '{}',
    });
    return await openSession(path);
}

test.each(namespaceCases)('$name retains its $kind identity and native output at $level in "$scope"', async (entry) => {
    await using sandbox = await testdir();
    const session = await namespaceSession(sandbox.path, entry);
    const manifest = session.manifests.get(entry.name)!;
    expect(manifest.configuration.kind).toBe(entry.kind);
    expect(session.manifests.has(entry.retired)).toBe(false);
    const plans = planRun(session, { stage: 'any', skips: [], only: [entry.check], includeUnsupported: true });
    expect(plans.map((planned) => planned.scope.scope.path)).toStrictEqual([entry.scope]);
    const detected = detectConfigurations(
        sandbox.path,
        session.repository.files,
        session.manifests,
        session.packageManifests,
        entry.scope,
    );
    expect(detected.some(({ configuration }) => configuration === entry.name)).toBe(
        entry.scope === '' || entry.detectsChild,
    );
    expect(
        session.scopes
            .find(({ scope }) => scope.path === 'sibling')!
            .selected.map(({ configuration }) => configuration.name),
    ).not.toContain('site');
    expect(emitAll(session).files.map(({ path }) => path)).toContain(
        targetInScope(entry.scope, manifest.toolFiles.find(({ target }) => target === entry.target)!),
    );
});

test.each(namespaceCases.filter(({ name }) => name === 'site'))(
    'site owns source inputs and structural checks at $level in "$scope"',
    async (entry) => {
        await using sandbox = await testdir();
        const session = await namespaceSession(sandbox.path, entry);
        expect(
            session.scopes.find(({ scope }) => scope.path === entry.scope)!.view.options('tools.svgo')
                .min_saving_percent,
        ).toBe(entry.level === 'all' ? 0 : 10);
        const input = buildCheckInput(session, 'site/build', { scope: entry.scope });
        expect(sourceConfigurations(input.selection.selected).map(({ configuration }) => configuration.name)).toContain(
            'site',
        );
        expect(input.files.find(({ path }) => path === posix.join(entry.scope, 'assets/logo.svg'))?.kind).toBe(
            'source',
        );
        const loneFiles = planRun(session, { stage: 'any', skips: [], only: ['structure/lone-files'] });
        expect(loneFiles.some(({ scope }) => scope.scope.path === entry.scope)).toBe(entry.level === 'all');
        if (entry.level === 'all')
            expect(
                await BUILT_IN_CALCULATIONS['structure/lone-files'](
                    buildCheckInput(session, 'structure/lone-files', { scope: entry.scope }),
                ),
            ).toMatchObject([{ file: posix.join(entry.scope, 'assets/logo.svg'), rule: 'lone-file' }]);
    },
);

test.each(['recommended', 'all'])('site preserves numeric and zero scope defaults at %s', async (level) => {
    await using sandbox = await testdir();
    const tables = `[tools.svgo]
min_saving_percent = 0
[scope."app"]
configurations = []
[scope."app/deep"]
configurations = []
[scope."sibling"]
removed_configurations = ["site"]
`;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['site'], { level, tables }),
        'index.html': '<!doctype html><title>Site</title>',
        'app/index.html': '<!doctype html><title>App</title>',
        'app/deep/index.html': '<!doctype html><title>Deep</title>',
        'sibling/index.html': '<!doctype html><title>Sibling</title>',
    });
    const inherited = await openSession(sandbox.path);
    for (const path of ['', 'app', 'app/deep']) {
        const scope = inherited.scopes.find(({ scope }) => scope.path === path)!;
        expect(scope.selected.map(({ configuration }) => configuration.name)).toContain('site');
        expect(scope.view.options('tools.svgo').min_saving_percent).toBe(0);
    }
    expect(
        inherited.scopes
            .find(({ scope }) => scope.path === 'sibling')!
            .selected.map(({ configuration }) => configuration.name),
    ).not.toContain('site');
    const overridden =
        tables +
        '\n[scope."app".tools.svgo]\nmin_saving_percent = 8\n[scope."app".reasons]\n"tools.svgo.min_saving_percent" = "The reviewed asset threshold is eight percent."\n';
    await writeFile(join(sandbox.path, 'gspot.toml'), buildPolicy(['site'], { level, tables: overridden }));
    const session = await openSession(sandbox.path);
    expect(
        session.scopes
            .filter(({ scope }) => scope.path !== 'sibling')
            .map(({ scope, view }) => [scope.path, view.options('tools.svgo').min_saving_percent]),
    ).toStrictEqual([
        ['', 0],
        ['app', 8],
        ['app/deep', 8],
    ]);
    expect(() => session.scopes.find(({ scope }) => scope.path === 'sibling')!.view.options('tools.svgo')).toThrow(
        'The selected scope has no tools.svgo settings.',
    );
});
