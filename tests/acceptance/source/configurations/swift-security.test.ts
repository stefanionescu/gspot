import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { containing } from '#tests/support/expectations.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
import { install, installPrivateTools } from '#tests/support/cli/tools.ts';

test(
    'Swift security initializes with the candidate plugin and retains immutable tool locks',
    async () => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        await createFileTree(root, {
            'Value.swift': 'import CryptoKit\nlet digest = Insecure.MD5.hash(data: data)\n',
            'scripts/build.js': 'export const buildName = "fixture";\n',
            'Info.plist': '<plist><dict><key>CFBundleName</key><string>Fixture</string></dict></plist>\n',
        });
        await install(root, [
            'init',
            '--yes',
            '--configurations',
            'swift',
            'javascript',
            'security',
            '--without',
            'spelling',
            'naming',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-rules',
            '--no-install',
        ]);
        const files = ['.gspot/package.json', '.gspot/bun.lock', '.gspot/pyproject.toml', '.gspot/uv.lock'];
        const before = await Promise.all(files.map(async (path) => await Bun.file(join(root, path)).text()));
        await installPrivateTools(root);
        expect(await Promise.all(files.map(async (path) => await Bun.file(join(root, path)).text()))).toStrictEqual(
            before,
        );
        expect(
            await Bun.file(join(root, '.gspot/node_modules/@gspot/eslint-plugin/package.json')).json(),
        ).toMatchObject({ name: '@gspot/eslint-plugin' });
        const command = ['check', '--only', 'security/semgrep', '--no-cache', '--json'];
        const broken = await run(root, command);
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        expect(reportSchema.parse(JSON.parse(broken.stdout)).checks).toMatchObject([
            { check: 'security/semgrep', status: 'fail' },
        ]);
        expect(reportSchema.parse(JSON.parse(broken.stdout)).checks[0]!.findings).toStrictEqual([
            containing({ rule: 'ios-weak-hash-algorithm', file: 'Value.swift', line: 2 }),
        ]);
        await Bun.write(join(root, 'Value.swift'), 'import CryptoKit\nlet digest = SHA256.hash(data: data)\n');
        const corrected = await run(root, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
            { check: 'security/semgrep', status: 'ok', findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS * 3,
);
