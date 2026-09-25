import { reportSchema } from '#cli/execution/report.ts';
import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { symlinkSync, writeFileSync } from 'node:fs';
import { commitAll } from '#tests/support/cli/git.ts';
// Planted repository: TypeScript selected in a scope only, with one ESLint configuration for the repository.
import { parsePolicyText } from '#cli/policy/read-policy.ts';
import { treeContents } from '#tests/support/cli/contents.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

const MODULES = join(import.meta.dir, '../../../../node_modules');
const SOURCE =
    '// The port the service listens on.\n\n/** The port, read once. */\nexport const port = Number("8080") as number;\n';

describe('typescript in a scope', () => {
    test(
        'the shared ESLint configuration reads TypeScript although the root selects none',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'README.md': '# planted\n',
                '.gitignore': 'node_modules\n',
                'package.json':
                    '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "workspaces": ["api"]\n}\n',
                'api/package.json':
                    '{\n    "name": "api",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module"\n}\n',
                'api/tsconfig.json':
                    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true\n    },\n    "include": ["src"]\n}\n',
                'api/src/port.ts': SOURCE,
            });
            symlinkSync(MODULES, join(sandbox.path, 'node_modules'));
            commitAll(sandbox.path);
            const environment = {
                PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}`,
            };
            const argv = [
                'init',
                '--yes',
                '--scope',
                'api=typescript',
                '--without',
                'naming',
                'spelling',
                'markdown',
                'docs',
                '--no-runner',
                '--no-ci',
                '--no-hooks',
                '--no-rules',
                '--no-install',
            ];
            await install(sandbox.path, argv, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const lint = await run(
                sandbox.path,
                ['check', '--only', 'typescript/eslint', '--no-cache', '--json'],
                environment,
            );
            expect(lint.code, lint.stdout + lint.stderr).toBe(1);
            const report = reportSchema.parse(JSON.parse(lint.stdout));
            expect(report.checks).toMatchObject([{ check: 'typescript/eslint', scope: 'api', status: 'fail' }]);
            expect(report.checks[0]?.findings).toContainEqual(
                expect.objectContaining({
                    check: 'typescript/eslint',
                    file: 'api/src/port.ts',
                    rule: '@typescript-eslint/no-unnecessary-type-assertion',
                    line: 4,
                }),
            );
            await Bun.write(join(sandbox.path, 'api/src/port.ts'), SOURCE.replace(' as number', ''));
            const corrected = await run(
                sandbox.path,
                ['check', '--only', 'typescript/eslint', '--no-cache', '--json'],
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
                { check: 'typescript/eslint', scope: 'api', status: 'ok', findings: [] },
            ]);
        },
        PLANTED_TIMEOUT_MS * 4,
    );

    test(
        'an ignore file inside a scope travels into the policy, and a one-word comment stays a reason the policy accepts',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'README.md': '# planted\n',
                'db/accounts.sql': 'SELECT 1;\n',
                'db/.sqlfluffignore': '# Templates\ntemplates/\n',
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['sqlfluff', 'typos', 'ec']) };
            const argv = [
                'init',
                '--yes',
                '--scope',
                'db=sql',
                '--without',
                'naming',
                'spelling',
                'markdown',
                'docs',
                '--no-runner',
                '--no-ci',
                '--no-hooks',
                '--no-rules',
                '--no-install',
            ];
            await install(sandbox.path, argv, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const policy = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
            expect(policy).toContain('db/**/templates/**');
            expect(policy).toContain('carried from db/.sqlfluffignore at init: Templates');
            const syntax = await run(sandbox.path, ['check', '--only', 'sql/syntax', '--no-cache'], environment);
            expect(syntax.code).toBe(0);
        },
        PLANTED_TIMEOUT_MS * 3,
    );
});

test('init proposes workspace scopes without a lockfile and preserves files after resolver failure', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"private":true,"workspaces":["packages/*"]}',
        'packages/api/package.json': '{"name":"api"}',
        'packages/api/source.js': 'export const port = 8080;\n',
    });
    const command = ['init', '--yes', '--no-hooks', '--no-ci', '--no-runner', '--no-rules', '--no-install'];
    const proposed = await run(sandbox.path, [...command, '--dry-run', '--json']);
    expect(proposed.code, proposed.stdout + proposed.stderr).toBe(0);
    const proposal = JSON.parse(proposed.stdout) as { policy: string };
    const policy = parsePolicyText(proposal.policy, 'gspot.toml');
    expect(policy.scopes.map((scope) => scope.path)).toStrictEqual(['packages/api']);
    writeFileSync(join(sandbox.path, 'pnpm-workspace.yaml'), 'packages: [');
    const before = treeContents(sandbox.path);
    const refused = await run(sandbox.path, command);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(treeContents(sandbox.path)).toStrictEqual(before);
    writeFileSync(join(sandbox.path, 'pnpm-workspace.yaml'), 'packages: ["packages/*"]\n');
    const corrected = await run(sandbox.path, [...command, '--dry-run', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(
        parsePolicyText(JSON.parse(corrected.stdout).policy, 'gspot.toml').scopes.map((scope) => scope.path),
    ).toStrictEqual(['packages/api']);
});
