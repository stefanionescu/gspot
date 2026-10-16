import * as fs from 'node:fs';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/setup/matchers.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { applyCommand } from '#cli/commands/apply.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { settingsText } from '#tests/setup/settings.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/bash/tools.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { readVersionPin, writeVersionPin, assertVersionPin } from '#cli/apply/version-pin.ts';

{
    test('a failed version pin write leaves the old version', async () => {
        await using repository = await testdir();
        await createFileTree(repository.path, {
            'gspot.toml': settingsText([]),
            '.gspot/version': '0.0.1\n',
        });
        const rename = fs.renameSync;
        using _failed = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
            if (String(target) === join(repository.path, '.gspot/version')) throw new Error('Pin write denied');
            rename(source, target);
        });

        expect(await rejection(applyCommand({ cwd: repository.path, isDryRun: false }))).toContain('Pin write denied');
        expect(await readFile(join(repository.path, '.gspot/version'), 'utf8')).toBe('0.0.1\n');
    });
}
{
    const { version: RUNNING_VERSION } = packageManifest;

    test('the version pin is written, read, and refused when it differs', async () => {
        await using sandbox = await testdir();
        expect(readVersionPin(sandbox.path)).toBeUndefined();
        {
            using log = openWriter(sandbox.path);
            writeVersionPin(log);
        }
        expect(readVersionPin(sandbox.path)).toBe(RUNNING_VERSION);
        expect(assertVersionPin(sandbox.path)).resolves.toBeUndefined();
        await writeFile(join(sandbox.path, '.gspot/version'), '9.9.9\n');
        const refused = assertVersionPin(sandbox.path);
        expect(refused).rejects.toThrow(
            [
                `This repository pins gspot 9.9.9, and you are running gspot ${RUNNING_VERSION}.`,
                'Install the pinned version: mise use --pin --tool-option allow_low_downloads=true npm:@gspothq/cli@9.9.9',
                'To upgrade the repository pin to this version: gspot apply',
            ].join('\n'),
        );
        expect(refused).rejects.toMatchObject({ code: 'pin' });
    });

    test('a different saved version blocks check while apply updates the pin', async () => {
        await using sandbox = await testdir({ 'gspot.toml': settingsText(['bash']), 'script.sh': CLEAN_BASH_SCRIPT });
        const prepared = await runGspot(sandbox.path, ['apply', '--json']);
        expect(prepared.code, prepared.stdout + prepared.stderr).toBe(0);
        await Bun.write(join(sandbox.path, '.gspot/version'), '9.9.9\n');
        const check = await runGspot(sandbox.path, ['check', '--json']);
        expect(check.code, check.stdout + check.stderr).toBe(2);
        expect(check.stdout).toContain('mise use --pin --tool-option allow_low_downloads=true npm:@gspothq/cli@9.9.9');
        expect(check.stdout).toContain('gspot apply');
        const doctor = await runGspot(sandbox.path, ['doctor', '--json']);
        expect(doctor.code, doctor.stdout + doctor.stderr).toBe(1);
        const applied = await runGspot(sandbox.path, ['apply', '--json']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        expect(readVersionPin(sandbox.path)).toBe(RUNNING_VERSION);
    });
}
