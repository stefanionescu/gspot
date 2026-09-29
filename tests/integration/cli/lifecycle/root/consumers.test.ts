import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { xcodePlan } from '#cli/commands/init/xcode.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { rejection } from '#tests/support/expectations.ts';
import { readOwnership } from '#cli/lifecycle/ownership/owner.ts';
import { astGrepMatches } from '#cli/checks/structure/ast-grep.ts';
import { chmodSync, existsSync, unlinkSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';

if (process.platform !== 'win32')
    describe('files discovery', () => {
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
                expect(readFileSync(join(directory.path, 'outside/schemes/Main.xcscheme'), 'utf8')).toBe(
                    'authored scheme',
                );
                expect(existsSync(join(root, '.gspot'))).toBe(false);
            },
        );
    });

test('structural rule caching bounds writes and preserves later rule edits', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/gspot.toml': 'version = 1\nlevel = "all"\nkits = ["bash"]\n[runner]\ntool = "mise"\n',
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
    expect(
        await rejection(astGrepMatches(input, 'packages/cli/kits/language/bash/rules/branches.yml', ['example.sh'])),
    ).toContain('Unsafe lifecycle parent');
    expect(readFileSync(join(directory.path, 'outside/ast-grep/branches.yml'), 'utf8')).toBe('external rule\n');
    unlinkSync(cache);
    expect(
        await astGrepMatches(input, 'packages/cli/kits/language/bash/rules/branches.yml', ['example.sh']),
    ).toHaveLength(1);
    expect(
        await astGrepMatches(input, 'packages/cli/kits/language/bash/rules/branches.yml', ['example.sh']),
    ).toHaveLength(1);
    const rule = '.gspot/cache/ast-grep/branches.yml';
    expect(readOwnership(root).files.find((entry) => entry.path === rule)?.kind).toBe('runtime');
    chmodSync(join(root, rule), 0o644);
    writeFileSync(join(root, rule), 'edited rule\n');
    expect(
        await rejection(astGrepMatches(input, 'packages/cli/kits/language/bash/rules/branches.yml', ['example.sh'])),
    ).toContain(`Retained edited or unowned structural rule: ${rule}`);
    expect(readFileSync(join(root, rule), 'utf8')).toBe('edited rule\n');
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
