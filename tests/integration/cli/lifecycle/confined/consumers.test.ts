import { join } from 'node:path';
import { planRun } from '#cli/execution/plan.ts';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import { xcodeProposal } from '#cli/commands/init/xcode.ts';
import { astGrepMatches } from '#cli/checks/structure/ast-grep.ts';
import { chmodSync, existsSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';

describe.skipIf(process.platform === 'win32')('confined discovery', () => {
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
            expect(() => xcodeProposal(root, [''])).toThrow(/(?:Unsafe lifecycle|Lifecycle destination)/u);
            expect(readFileSync(join(directory.path, 'outside/periphery.yml'), 'utf8')).toBe(
                'schemes:\n  - Authored\n',
            );
            expect(readFileSync(join(directory.path, 'outside/schemes/Main.xcscheme'), 'utf8')).toBe('authored scheme');
            expect(existsSync(join(root, '.gspot'))).toBe(false);
        },
    );
});

test('structural rule caching confines writes and preserves later rule edits', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["bash"]\n[runner]\ntool = "mise"\n',
        'project/example.sh': 'if true; then echo yes; fi\n',
        'project/.gspot/.keep': '',
        'outside/ast-grep/bash-branches.yml': 'external rule\n',
    });
    const root = join(directory.path, 'project');
    const cache = join(root, '.gspot/cache');
    const session = await openSession(root);
    const [planned] = await planRun(session, { stage: 'commit', skips: [], only: ['structure/bash-branches'] });
    const input = engineInput(session, planned!);
    symlinkSync('../../outside', cache);
    const run = () =>
        astGrepMatches(input, 'packages/cli/configurations/language/bash/rules/bash-branches.yml', ['example.sh']);
    await expect(run()).rejects.toThrow('Unsafe lifecycle parent');
    expect(readFileSync(join(directory.path, 'outside/ast-grep/bash-branches.yml'), 'utf8')).toBe('external rule\n');
    unlinkSync(cache);
    expect(await run()).toHaveLength(1);
    expect(await run()).toHaveLength(1);
    const rule = '.gspot/cache/ast-grep/bash-branches.yml';
    expect(readOwnership(root).files.find((entry) => entry.path === rule)?.kind).toBe('runtime');
    chmodSync(join(root, rule), 0o644);
    writeFileSync(join(root, rule), 'edited rule\n');
    await expect(run()).rejects.toThrow(`Retained edited or unowned structural rule: ${rule}`);
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
    expect(xcodeProposal(directory.path, [''])).toStrictEqual({
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
    expect(() => xcodeProposal(directory.path, [''])).toThrow();
    writeFileSync(join(directory.path, '.periphery.yml'), 'schemes: []\n');
    expect(xcodeProposal(directory.path, [''])).toStrictEqual({
        scope: '',
        project: 'app.xcodeproj',
        scheme: 'Fallback',
    });
});
