import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { git } from '#tests/support/cli/git.ts';
import { checkInput } from '#tests/support/cli/input.ts';
import { envFiles } from '#cli/checks/security/env/files.ts';
import { refusalFor } from '#cli/commands/check/selection.ts';
import type { CheckOptions } from '#cli/types/commands/check.ts';

test('staged refusal and tracked-file checks agree on environment files and templates in nested folders', async () => {
    await using directory = await testdir();
    const privateFiles = ['.env', '.env.local', 'nested/.dev.vars', 'nested/.dev.vars.production'];
    const templates = ['.env.example', '.env.template', 'nested/.env.sample', 'nested/.dev.vars.example'];
    await createFileTree(
        directory.path,
        Object.fromEntries([...privateFiles, ...templates].map((path) => [path, 'EXAMPLE=value\n'])),
    );
    expect(git(directory.path, ['init', '-q']).code).toBe(0);
    expect(git(directory.path, ['add', '-f', '.']).code).toBe(0);
    const input = await checkInput(directory.path, 'integrity/env-files', [], { configurations: ['secrets'] });
    expect(envFiles(input).map(({ file, rule }) => ({ file, rule }))).toStrictEqual(
        privateFiles.map((file) => ({ file, rule: 'tracked-environment-file' })),
    );
    const options: CheckOptions = {
        cwd: directory.path,
        paths: [],
        staged: true,
        fix: false,
        isDryRun: false,
        skips: [],
        quiet: true,
        verbose: false,
        noCache: true,
    };
    const refused = refusalFor(options, 'commit', [...privateFiles, ...templates]);
    expect(refused?.exitCode).toBe(1);
    expect(refused?.json).toStrictEqual({ failed: ['integrity/env-files'], files: privateFiles });
    expect(refusalFor(options, 'commit', templates)).toBeUndefined();
});
