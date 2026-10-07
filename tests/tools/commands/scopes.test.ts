// Test repository: TypeScript selected in a scope only, with one ESLint configuration for the repository.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { QUIET_INIT } from '#tests/config/harness/init.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { linkInstalledModules } from '#tests/harness/platforms.ts';
import { install, buildSandboxPath } from '#tests/harness/install.ts';
import { SCOPES_SOURCE } from '#tests/config/tools/commands/scopes.ts';
import { STRICT_COMPILER_OPTIONS } from '#tests/config/samples/typescript.ts';

test(
    'typescript in a scope > the shared ESLint configuration reads TypeScript although the root selects none',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'README.md': '# test\n',
            '.gitignore': 'node_modules\n',
            'package.json':
                '{\n    "name": "example",\n    "version": "1.0.0",\n    "description": "A test repository for the tests.",\n    "private": true,\n    "type": "module",\n    "workspaces": ["api"]\n}\n',
            'api/package.json':
                '{\n    "name": "api",\n    "version": "1.0.0",\n    "description": "A test service for the tests.",\n    "private": true,\n    "type": "module"\n}\n',
            'api/tsconfig.json':
                JSON.stringify({ compilerOptions: { ...STRICT_COMPILER_OPTIONS }, include: ['src'] }, null, 4) + '\n',
            'api/src/port.ts': SCOPES_SOURCE,
        });
        linkInstalledModules(join(sandbox.path, 'node_modules'));
        commitAll(sandbox.path);
        const environment = {
            PATH: buildSandboxPath(['typos', 'ec', 'ast-grep']),
        };
        const argv = ['init', '--yes', '--scope-configurations', 'api=typescript', ...QUIET_INIT];
        await install(sandbox.path, argv, environment, { level: 'all' });
        const command = ['check', '--only', 'javascript/eslint', '--json'];
        const lint = await spawnGspot(sandbox.path, command, environment);
        expect(lint.code, lint.stdout + lint.stderr).toBe(1);
        const report = JSON.parse(lint.stdout) as RunReport;
        // TypeScript source belongs to the API scope; the root manifest is also linted as metadata.
        const api = report.checks.find((check) => check.scope === 'api');
        expect(api).toMatchObject({ check: 'javascript/eslint', status: 'failed' });
        expect(api?.findings).toContainEqual(
            containing({
                check: 'javascript/eslint',
                file: 'api/src/port.ts',
                rule: '@typescript-eslint/no-unnecessary-type-assertion',
                line: 4,
            }),
        );
        await Bun.write(join(sandbox.path, 'api/src/port.ts'), SCOPES_SOURCE.replace(' as number', ''));
        const corrected = await spawnGspot(sandbox.path, command, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'javascript/eslint', scope: '', status: 'passed', fileCount: 1, findings: [] },
            { check: 'javascript/eslint', scope: 'api', status: 'passed', fileCount: 2, findings: [] },
        ]);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
