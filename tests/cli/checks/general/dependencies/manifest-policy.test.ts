import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { parsePackageManifest } from '#cli/parsers/packages/public.ts';
import { MANIFEST, REGISTRY_ALIASES } from '#tests/config/cli/checks/general/dependencies/manifest-policy.ts';

const DEPENDENCIES_POLICY = buildPolicy(['dependencies']);

describe('manifest policy reads', () => {
    test('accepts an absent optional manifest and a valid manifest', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': DEPENDENCIES_POLICY, 'README.md': '# Example\n' });
        expect(
            BUILT_IN_CHECKS['dependencies/manifests'].input(
                buildCheckInput(await openSession(sandbox.path), 'dependencies/manifests'),
            ),
        ).toStrictEqual([]);
        await writeFile(join(sandbox.path, 'package.json'), MANIFEST);
        expect(
            BUILT_IN_CHECKS['dependencies/manifests'].input(
                buildCheckInput(await openSession(sandbox.path), 'dependencies/manifests'),
            ),
        ).toStrictEqual([]);
    });
});

test.each(['recommended', 'all'] as const)(
    '%s checks dependency pins with ESLint and preserves scoped path ignores',
    async (level) => {
        await using sandbox = await testdir();
        const base = parsePackageManifest(MANIFEST);
        const ranged = JSON.stringify({ ...base, dependencies: { example: '^1.2.3' } });
        const policy = buildPolicy(['javascript', 'dependencies'], {
            level: level,
            tables: '[scope."app"]\nconfigurations = ["javascript"]\n',
        });
        await createFileTree(sandbox.path, {
            'gspot.toml': policy,
            'package.json': ranged,
            'app/package.json': ranged,
            'app/other/package.json': ranged,
        });
        const paths = ['package.json', 'app/package.json', 'app/other/package.json'];
        const initial = await createEslint(sandbox.path);
        const initialResults = await initial.lintFiles(paths);
        expect(
            initialResults.map(
                ({ messages }) =>
                    messages.filter(({ ruleId }) => ruleId === 'package-json/restrict-dependency-ranges').length,
            ),
        ).toStrictEqual([1, 1, 1]);
        await Bun.write(
            join(sandbox.path, 'gspot.toml'),
            policy +
                '[[ignore]]\ncheck = "javascript/eslint"\nrule = "package-json/restrict-dependency-ranges"\npaths = ["app/package.json"]\nreason = "The published package supports compatible dependency versions."\n',
        );
        await writeFile(
            join(sandbox.path, 'package.json'),
            JSON.stringify({ ...base, dependencies: { example: '1.2.3' } }),
        );
        const retained = await createEslint(sandbox.path);
        const retainedResults = await retained.lintFiles(paths);
        expect(
            retainedResults.map(
                ({ messages }) =>
                    messages.filter(({ ruleId }) => ruleId === 'package-json/restrict-dependency-ranges').length,
            ),
        ).toStrictEqual([0, 0, 1]);
        expect(
            BUILT_IN_CHECKS['dependencies/manifests'].input(
                buildCheckInput(await openSession(sandbox.path), 'dependencies/manifests'),
            ),
        ).toStrictEqual([]);
    },
);

test.each(
    REGISTRY_ALIASES.flatMap((version) => (['recommended', 'all'] as const).map((level) => ({ version, level }))),
)('$level native dependency pin rules retain registry alias $version', async ({ version, level }) => {
    await using sandbox = await testdir();
    const base = parsePackageManifest(MANIFEST);
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript', 'dependencies'], { level: level }),
        'package.json': JSON.stringify({ ...base, dependencies: { alias: version, example: '^1.2.3' } }),
    });
    const eslint = await createEslint(sandbox.path);
    const initial = await eslint.lintFiles(['package.json']);
    expect(
        initial
            .flatMap(({ messages }) => messages)
            .filter(({ ruleId }) => ruleId === 'package-json/restrict-dependency-ranges'),
    ).toMatchObject([{ messageId: 'wrongRangeType' }]);
    expect(
        initial
            .flatMap(({ messages }) => messages)
            .filter(({ ruleId }) => ruleId === 'package-json/restrict-dependency-ranges'),
    ).toHaveLength(1);
    await writeFile(
        join(sandbox.path, 'package.json'),
        JSON.stringify({ ...base, dependencies: { alias: version, example: '1.2.3' } }),
    );
    const corrected = await eslint.lintFiles(['package.json']);
    expect(
        corrected
            .flatMap(({ messages }) => messages)
            .filter(({ ruleId }) => ruleId === 'package-json/restrict-dependency-ranges'),
    ).toStrictEqual([]);
});
