import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { emitAll } from '#cli/emit/targets.ts';
import { openSession } from '#cli/run/session.ts';
import { createFileTree, testdir } from 'testdirs';
import { parse, stringify, TomlDate } from 'smol-toml';
import { readRepository } from '#cli/repository/tree.ts';
import { collectCarried } from '#cli/adoption/collect.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';

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
        const output = emitAll(await openSession(sandbox.path)).files.find(
            (file) => file.path === '.gspot/config/osv-scanner.toml',
        )!;
        const parsed = parse(output.content) as { IgnoredVulns: { ignoreUntil: TomlDate }[] };
        expect(parsed.IgnoredVulns[0]!.ignoreUntil.toISOString()).toBe(new TomlDate(expiration).toISOString());
        expect(await Bun.file(join(sandbox.path, 'osv-scanner.toml')).text()).toBe(original);
    },
);
