import { symlinkSync } from 'node:fs';
// Planted repository: TypeScript selected in a scope only, with one ESLint configuration for the repository.
import { delimiter, join } from 'node:path';
import { createSandbox } from '@gspot/testing';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, toolsPath } from '#tests/harness/planted.ts';

const MODULES = join(import.meta.dir, '../../../node_modules');
const SOURCE =
    '// The port the service listens on.\n\n/** The port, read once. */\nexport const port = Number("8080") as number;\n';

describe('typescript in a scope', () => {
    test(
        'the shared ESLint configuration reads TypeScript although the root selects none',
        async () => {
            await using sandbox = await createSandbox({
                'README.md': '# planted\n',
                '.gitignore': 'node_modules\n',
                'package.json':
                    '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "workspaces": ["api"]\n}\n',
                'api/package.json':
                    '{\n    "name": "api",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module"\n}\n',
                'api/tsconfig.json':
                    '{\n    "extends": "../.gspot/api/tsconfig.base.json",\n    "include": ["src"]\n}\n',
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
                '--runner',
                'none',
                '--ci',
                'none',
                '--hooks',
                'none',
                '--no-rules',
                '--no-install',
            ];
            await install(sandbox.path, argv, environment);
            const lint = await run(sandbox.path, ['check', '--only', 'typescript/eslint', '--no-cache'], environment);
            expect(lint.stdout + lint.stderr).not.toContain('Parsing error');
            const written = await Bun.file(join(sandbox.path, '.gspot/eslint.config.mjs')).text();
            expect(written).toContain('tseslint.configs.strictTypeChecked');
            expect(lint.stdout).toContain('typescript/eslint');
        },
        PLANTED_TIMEOUT_MS * 4,
    );

    test(
        'an ignore file inside a scope travels into the policy, and a one-word comment stays a reason the policy accepts',
        async () => {
            await using sandbox = await createSandbox({
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
                'structure',
                '--runner',
                'none',
                '--ci',
                'none',
                '--hooks',
                'none',
                '--no-rules',
                '--no-install',
            ];
            await install(sandbox.path, argv, environment);
            const policy = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
            expect(policy).toContain('db/**/templates/**');
            expect(policy).toContain('carried from db/.sqlfluffignore at init: Templates');
            const syntax = await run(sandbox.path, ['check', '--only', 'sql/syntax', '--no-cache'], environment);
            expect(syntax.code).toBe(0);
        },
        PLANTED_TIMEOUT_MS * 3,
    );
});
