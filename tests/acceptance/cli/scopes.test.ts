// Planted repository: TypeScript selected in a scope only, with one ESLint configuration for the repository.
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/harness/cli/git.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { INSTALLED_BIN_PATH } from '#tests/harness/cli/modules.ts';
import { linkInstalledModules } from '#tests/harness/cli/platforms.ts';
import { toolsPath, installAtLevel } from '#tests/harness/tools/install.ts';

const ROOT_KITS = ['dependencies', 'docs', 'files', 'secrets', 'spelling'];
const SCOPES_SOURCE =
    '// The port the service listens on.\n\n/** The port, read once. */\nexport const port = Number("8080") as number;\n';

test(
    'typescript in a scope > the shared ESLint configuration reads TypeScript although the root selects none',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'README.md': '# planted\n',
            '.gitignore': 'node_modules\n',
            'package.json':
                '{\n    "name": "planted",\n    "version": "1.0.0",\n    "description": "A planted repository for the tests.",\n    "private": true,\n    "type": "module",\n    "workspaces": ["api"]\n}\n',
            'api/package.json':
                '{\n    "name": "api",\n    "version": "1.0.0",\n    "description": "A planted service for the tests.",\n    "private": true,\n    "type": "module"\n}\n',
            'api/tsconfig.json':
                '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true\n    },\n    "include": ["src"]\n}\n',
            'api/src/port.ts': SCOPES_SOURCE,
        });
        linkInstalledModules(join(sandbox.path, 'node_modules'));
        commitAll(sandbox.path);
        const environment = {
            PATH: `${INSTALLED_BIN_PATH}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}`,
        };
        const argv = [
            'init',
            '--yes',
            '--scope',
            'api=typescript',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-guides',
            '--no-install',
        ];
        // The root kits init selects in every repository install tools the ESLint check never runs.
        await installAtLevel(sandbox.path, argv, environment, 'all', ROOT_KITS);
        const command = ['check', '--only', 'javascript/eslint', '--json'];
        const lint = await spawnGspot(sandbox.path, command, environment);
        expect(lint.code, lint.stdout + lint.stderr).toBe(1);
        const report = JSON.parse(lint.stdout) as RunReport;
        // The root lints its package.json; the api scope lints TypeScript through the same configuration.
        const api = report.checks.find((check) => check.scope === 'api');
        expect(api).toMatchObject({ check: 'javascript/eslint', status: 'fail' });
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
            { check: 'javascript/eslint', scope: '', status: 'ok', findings: [] },
            { check: 'javascript/eslint', scope: 'api', status: 'ok', findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS * 4,
);
