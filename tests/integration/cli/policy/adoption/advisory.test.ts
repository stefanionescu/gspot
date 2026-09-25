import { openSession } from '#cli/execution/session.ts';
import { emitAll } from '#cli/generation/render.ts';
import { collectCarried } from '#cli/policy/adoption/collect.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';
import { readRepository } from '#cli/repository/tree.ts';
import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { parse, stringify, TomlDate } from 'smol-toml';
import { createFileTree, testdir } from 'testdirs';

test.each(['2030-11-09', '2030-11-09T16:42:12Z', '2030-11-09T16:42:12-05:30'])(
    'advisory adoption preserves expiration %s through generated native configuration',
    async (expiration) => {
        await using sandbox = await testdir();
        const original = `[[IgnoredVulns]]\nid = "GO-2022-0968"\nignoreUntil = ${expiration}\nreason = "The affected service is not exposed."\n`;
        await createFileTree(sandbox.path, { 'osv-scanner.toml': original });
        const repository = await readRepository(sandbox.path, [], [], []);
        const discovered = existingTooling(sandbox.path, repository.files, []);
        const carried = await collectCarried(sandbox.path, discovered, new Set(['dependencies']), []);
        expect(carried.unread).toStrictEqual([]);
        expect(carried.removed.map((entry) => entry.path)).toStrictEqual(['osv-scanner.toml']);
        await Bun.write(
            join(sandbox.path, 'gspot.toml'),
            stringify({
                version: 1,
                configurations: ['dependencies'],
                tools: Object.fromEntries([...carried.tools].map(([tool, entry]) => [tool, entry.settings])),
            }),
        );
        const renderSession1 = await openSession(sandbox.path);
        const output = emitAll(renderSession1.policyFiles.policy, renderSession1.repository, renderSession1.scopes, {
            version: renderSession1.version,
            packageManager: renderSession1.packageManager,
        }).files.find((file) => file.path === '.gspot/config/osv-scanner.toml')!;
        const parsed = parse(output.content) as { IgnoredVulns: { ignoreUntil: TomlDate }[] };
        expect(parsed.IgnoredVulns[0]!.ignoreUntil.toISOString()).toBe(new TomlDate(expiration).toISOString());
        expect(await Bun.file(join(sandbox.path, 'osv-scanner.toml')).text()).toBe(original);
    },
);
