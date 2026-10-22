import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test('each configuration with ESLint blocks gets its own ESLint config file, and the main file spreads it in plan order', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript', 'zod']),
        'package.json': '{"private":true,"type":"module","dependencies":{"zod":"4.0.0"}}',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src"]}',
        'src/index.ts': 'export const answer = 42;\n',
    });

    const files = generate(await openSession(sandbox.path)).files.filter((file) => file.path.endsWith('/eslint.mjs'));
    expect(files.map((file) => file.path)).toStrictEqual([
        '.gspot/configurations/language/javascript/eslint.mjs',
        '.gspot/configurations/language/typescript/eslint.mjs',
        '.gspot/configurations/library/zod/eslint.mjs',
    ]);
    const [main, typescript] = files.map((file) => file.content);
    expect(main).toContain('import typescriptBlocks from "../typescript/eslint.mjs";');
    expect(main).toContain('import zodBlocks from "../../library/zod/eslint.mjs";');
    expect(main).toContain('    ...typescriptBlocks,\n    ...zodBlocks,\n');
    expect(main).not.toContain('from "typescript-eslint"');
    expect(typescript).toContain('from "../javascript/eslint-functions.mjs";');
    expect(typescript).toContain('import tseslint from "typescript-eslint";');
    expect(typescript).toContain('export default [\n    // typescript');
});
