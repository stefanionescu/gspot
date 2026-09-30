import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { xcodePlan } from '#cli/commands/init/xcode.ts';
import { onPosix } from '#tests/support/cli/platforms.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { rejection } from '#tests/support/expectations.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { astGrepMatches } from '#cli/checks/bash/ast-grep.ts';
import { readOwnership } from '#cli/lifecycle/ownership/owner.ts';
import { existsSync, unlinkSync, readdirSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';

describe.if(onPosix)('files discovery', () => {
    test.each(['project', 'configuration', 'schemes'] as const)(
        'Xcode discovery rejects a symlinked %s and leaves outside data unchanged',
        async (kind) => {
            await using directory = await testdir();
            await createFileTree(directory.path, {
                'project/app.xcodeproj/.keep': '',
                'outside/schemes/Main.xcscheme': 'authored scheme',
                'outside/periphery.yml': 'schemes:\n  - Authored\n',
            });
            const root = join(directory.path, 'project');
            if (kind === 'project') symlinkSync('../outside', join(root, 'aaa.xcodeproj'));
            if (kind === 'configuration') symlinkSync('../outside/periphery.yml', join(root, '.periphery.yml'));
            if (kind === 'schemes') symlinkSync('../../outside', join(root, 'app.xcodeproj/xcshareddata'));
            expect(() => xcodePlan(root, [''])).toThrow(/(?:Unsafe lifecycle|Lifecycle destination)/u);
            expect(readFileSync(join(directory.path, 'outside/periphery.yml'), 'utf8')).toBe(
                'schemes:\n  - Authored\n',
            );
            expect(readFileSync(join(directory.path, 'outside/schemes/Main.xcscheme'), 'utf8')).toBe('authored scheme');
            expect(existsSync(join(root, '.gspot'))).toBe(false);
        },
    );
});

test('the structural rule file stays inside the repository and an edited copy is written again', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/gspot.toml': policyOf(['bash'], '[runner]\ntool = "mise"\n', 'all'),
        'project/example.sh': 'if true; then echo yes; fi\n',
        'project/.gspot/.keep': '',
        'outside/ast-grep/branches.yml': 'external rule\n',
    });
    const root = join(directory.path, 'project');
    const cache = join(root, '.gspot/cache');
    const session = await openSession(root);
    const [planned] = planRun(session, { stage: 'commit', skips: [], only: ['structure/bash-limits'] });
    const input = engineInput(session, planned!);
    symlinkSync('../../outside', cache);
    expect(await rejection(astGrepMatches(input, 'kits/language/bash/rules/branches.yml', ['example.sh']))).toContain(
        'Unsafe lifecycle parent',
    );
    expect(readdirSync(join(directory.path, 'outside'), { recursive: true })).toStrictEqual([
        'ast-grep',
        join('ast-grep', 'branches.yml'),
    ]);
    unlinkSync(cache);
    expect(await astGrepMatches(input, 'kits/language/bash/rules/branches.yml', ['example.sh'])).toHaveLength(1);
    const [rule] = readdirSync(cache);
    writeFileSync(join(cache, rule!), 'id: edited\n');
    expect(await astGrepMatches(input, 'kits/language/bash/rules/branches.yml', ['example.sh'])).toHaveLength(1);
    expect(readdirSync(cache)).toStrictEqual([rule!]);
    expect(readFileSync(join(cache, rule!), 'utf8')).not.toBe('id: edited\n');
    expect(readOwnership(root).files).toStrictEqual([]);
});

test.each([
    'schemes: ["Authored # scheme"]\n',
    'schemes:\n  # Preserve the selected scheme.\n  - "Authored # scheme"\n',
    'schemes: &schemes\n  - "Authored # scheme"\nretain_public: true\n',
])('Xcode discovery reads YAML scheme syntax: %s', async (configuration) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'app.xcodeproj/xcshareddata/xcschemes/Fallback.xcscheme': '',
        '.periphery.yml': configuration,
    });
    expect(xcodePlan(directory.path, [''])).toStrictEqual({
        scope: '',
        project: 'app.xcodeproj',
        scheme: 'Authored # scheme',
    });
});

test('Xcode discovery rejects invalid scheme settings and accepts their correction', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'app.xcodeproj/xcshareddata/xcschemes/Fallback.xcscheme': '',
        '.periphery.yml': 'schemes: [42]\n',
    });
    expect(() => xcodePlan(directory.path, [''])).toThrow();
    writeFileSync(join(directory.path, '.periphery.yml'), 'schemes: []\n');
    expect(xcodePlan(directory.path, [''])).toStrictEqual({
        scope: '',
        project: 'app.xcodeproj',
        scheme: 'Fallback',
    });
});
