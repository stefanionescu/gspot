import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { testdir, createFileTree } from 'testdirs';
import { runTestCommand } from '#tests/harness/command.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { workspaceRoot as root } from '#automation/workspace.ts';
import { RELEASE_PLATFORMS } from '#tests/config/cli/automation/release/artifacts.ts';
import { existsSync, unlinkSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

test.each(['valid', 'missing', 'malformed checksum', 'changed archive'] as const)(
    'release preparation verifies all five CI archives before writing output: %s',
    async (state) => {
        await using sandbox = await testdir();
        const input = join(sandbox.path, 'input');
        const output = join(sandbox.path, 'output');
        const archives = RELEASE_PLATFORMS.map((platform) => {
            const name = `gspot-${cliPackage.version}-${platform}.tar.gz`;
            const bytes = Buffer.from(`CI archive bytes for ${platform}\n`);
            const checksum = createHash('sha256').update(bytes).digest('hex');
            return { name, bytes, checksum, path: `input/gspot-binary-${platform}/${name}` };
        });
        const files: Record<string, string | Buffer> = Object.fromEntries(
            archives.flatMap<[string, string | Buffer]>((archive) => [
                [archive.path, archive.bytes],
                [archive.path.replace(archive.name, 'SHA256SUMS'), `${archive.checksum}  ${archive.name}\n`],
            ]),
        );
        await createFileTree(sandbox.path, files);
        const last = archives.at(-1)!;
        const changes = {
            missing: () => {
                unlinkSync(join(sandbox.path, last.path));
            },
            'malformed checksum': () => {
                writeFileSync(join(sandbox.path, last.path.replace(last.name, 'SHA256SUMS')), 'invalid checksum\n');
            },
            'changed archive': () => {
                writeFileSync(join(sandbox.path, last.path), 'Changed after verification.\n');
            },
        };
        if (state !== 'valid') changes[state]();
        const command = await runTestCommand(
            [process.execPath, join(root, 'scripts/release/artifacts.ts'), input, output],
            { cwd: root },
            'prepare verified standalone release archives',
        );
        if (state === 'valid') {
            expect(command.code, command.stdout + command.stderr).toBe(0);
            expect(readdirSync(output).toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
                ['SHA256SUMS', ...archives.map(({ name }) => name)].toSorted((left, right) =>
                    left.localeCompare(right),
                ),
            );
            expect(readFileSync(join(output, 'SHA256SUMS'), 'utf8')).toBe(
                archives.map(({ name, checksum }) => `${checksum}  ${name}\n`).join(''),
            );
            for (const archive of archives)
                expect(readFileSync(join(output, archive.name))).toStrictEqual(archive.bytes);
        } else {
            expect(command.code, command.stdout + command.stderr).toBe(1);
            expect(command.stderr).toContain(
                {
                    missing: last.name,
                    'malformed checksum': 'must contain the checksum',
                    'changed archive': 'CI archive checksum differs',
                }[state],
            );
            expect(existsSync(output)).toBe(false);
        }
    },
);
