import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { toolPin } from '#cli/tools/pins.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { EXECUTABLE_FILE } from '#cli/config/platform/root.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { hasValePackages, installValePackages } from '#cli/tools/vale.ts';
import { VALE_ACQUISITION_FAILURES, CORRECTED_VALE_ACQUISITION } from '#tests/config/cli/tools/vale.ts';

test.each(VALE_ACQUISITION_FAILURES)(
    'Vale acquisition preserves installed styles after %s and succeeds after correction',
    async (failure, script, expected, tables) => {
        await using directory = await testdir();
        const installed = '.gspot/config/vale/styles/LocalStyle/terms.yml';
        await createFileTree(directory.path, {
            'gspot.toml': buildPolicy(['prose'], { tables }),
            '.gspot/config/vale.ini': 'Packages=LocalStyle\n',
            [installed]: 'original bytes\n',
            'guide.md': 'Authored text.\n',
        });
        const session = await openSession(directory.path);
        const version = toolPin(session.manifests.values(), 'vale').version;
        const executable = join(directory.path, 'node_modules/.bin/vale');
        const launcher = `#!${process.execPath}\nif (process.argv.includes('--version')) console.log(${JSON.stringify(version)});\nelse {\n${script}\n}\n`;
        await createFileTree(directory.path, { 'node_modules/.bin/vale': launcher });
        chmodSync(executable, EXECUTABLE_FILE);
        if (failure === 'cancellation') session.cancelSignal = AbortSignal.abort();
        expect(await installValePackages(session)).toBe(expected);
        expect(readFileSync(join(directory.path, installed), 'utf8')).toBe('original bytes\n');
        expect(readFileSync(join(directory.path, 'guide.md'), 'utf8')).toBe('Authored text.\n');
        delete session.cancelSignal;
        writeFileSync(executable, launcher.replace(script, CORRECTED_VALE_ACQUISITION));
        expect(await installValePackages(session)).toBeUndefined();
        expect(readFileSync(join(directory.path, installed), 'utf8')).toBe('corrected bytes\n');
        expect(hasValePackages(directory.path)).toBe(true);
        expect(readFileSync(join(directory.path, 'guide.md'), 'utf8')).toBe('Authored text.\n');
    },
);
