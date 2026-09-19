// Planted repository: TypeScript selected in a scope only, with one ESLint configuration for the repository.
import { join } from 'node:path';
import { symlinkSync } from 'node:fs';
import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, toolsPath } from '#tests/harness/planted.ts';

const MODULES = join(import.meta.dir, '../../node_modules');
const SOURCE =
    '// The port the service listens on.\n\n/** The port, read once. */\nexport const port = Number("8080") as number;\n';

describe('typescript in a scope', () => {
    test(
        'the shared ESLint configuration reads TypeScript although the root selects none',
        async () => {
            await using fixture = await createFixture({
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
            symlinkSync(MODULES, join(fixture.path, 'node_modules'));
            commitAll(fixture.path);
            const environment = { PATH: `${MODULES}/.bin:${toolsPath(['typos', 'ec', 'ast-grep'])}` };
            const argv = [
                'init',
                '--yes',
                '--scope',
                'api=typescript',
                '--without',
                'naming,spelling,markdown,docs',
                '--runner',
                'none',
                '--ci',
                'none',
                '--hooks',
                'none',
                '--no-rules',
                '--no-install',
            ];
            await install(fixture.path, argv, environment);
            const lint = run(fixture.path, ['check', 'typescript/eslint', '--no-cache'], environment);
            expect(lint.stdout + lint.stderr).not.toContain('Parsing error');
            expect(lint.stdout).toContain('typescript/eslint');
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
