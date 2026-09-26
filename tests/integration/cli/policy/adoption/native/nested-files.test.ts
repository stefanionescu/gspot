import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { readRepository } from '#cli/repository/tree.ts';
import { collectCarried } from '#cli/policy/adoption/collect.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';

test.each([
    ['.sqlfluffignore', 'sql', 'sqlfluff', 'exclude'],
    ['.semgrepignore', 'security', 'semgrep', 'ignore'],
] as const)(
    'declared %s adoption keeps nested selectors and refuses negation',
    async (name, configuration, tool, key) => {
        await using sandbox = await testdir();
        const path = `nested/${name}`;
        const original = '# Generated fixtures\nfixtures/\n';
        await createFileTree(sandbox.path, { [path]: original });
        const repository = await readRepository(sandbox.path, [], [], []);
        const discovered = existingTooling(sandbox.path, repository.files, []);
        const carried = await collectCarried(sandbox.path, discovered, new Set([configuration]), []);
        expect(carried.unread).toStrictEqual([]);
        expect(carried.tools.get(tool)?.settings[key]).toStrictEqual([
            { paths: ['nested/**/fixtures/**'], reason: expect.any(String) },
        ]);
        expect(carried.removed.map((entry) => entry.path)).toStrictEqual([path]);
        const unsupported = `${original}!fixtures/checked.sql\n`;
        await Bun.write(join(sandbox.path, path), unsupported);
        const refused = await collectCarried(sandbox.path, discovered, new Set([configuration]), []);
        expect(refused.unread.map((entry) => entry.path)).toStrictEqual([path]);
        expect(refused.tools.get(tool)?.settings[key] ?? []).toStrictEqual([]);
        expect(refused.removed).toStrictEqual([]);
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(unsupported);
    },
);

test.each([
    ['gitleaks.toml', 'secrets', '[allowlist]\nregexes = ["example-token"]\n'],
    ['osv-scanner.toml', 'dependencies', '[[IgnoredVulns]]\nid = "GO-2022-0968"\n'],
    ['.license-checker.json', 'licenses', '{"onlyAllow":"MIT"}\n'],
] as const)(
    'nested %s cannot silently widen settings to the whole repository',
    async (name, configuration, original) => {
        await using sandbox = await testdir();
        const path = `nested/${name}`;
        await createFileTree(sandbox.path, { [path]: original });
        const repository = await readRepository(sandbox.path, [], [], []);
        const discovered = existingTooling(sandbox.path, repository.files, []);
        const carried = await collectCarried(sandbox.path, discovered, new Set([configuration]), []);
        expect(carried.unread.map((entry) => entry.path)).toStrictEqual([path]);
        expect(carried.tools.size).toBe(0);
        expect(carried.removed).toStrictEqual([]);
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(original);
    },
);
