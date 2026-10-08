import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';

import {
    TRPC_FILES,
    TRPC_TYPES,
    TRPC_LEVELS,
    TRPC_IMPORTS,
    TRPC_MODULES,
    TRPC_FAILURES,
} from '#tests/config/cli/checks/library/trpc.ts';

test.each(TRPC_LEVELS)('the generated native tRPC rule composes server value boundaries at %s', async (level) => {
    await using sandbox = await testdir();
    const policy = buildPolicy(['trpc', 'typescript'], {
        level,
        tables: `${TRPC_MODULES}[scope.app]\n[scope.app.architecture]\nmodules = [{name = "server", paths = ["private/**"], may_import = ["server"]}]\n[scope."app/child"]\n[scope."app/child".architecture]\nmodules = [{name = "server", paths = ["private/**"], may_import = ["server"]}]\n[scope.flat]\n[scope.flat.architecture]\nmodules = [{name = "server", paths = ["router.ts"], may_import = ["server"]}]\n`,
    });
    const files = {
        ...TRPC_FILES,
        'gspot.toml': policy,
        ...Object.fromEntries(
            TRPC_IMPORTS.map(({ source }, index) => [`form${String(index)}.ts`, `// Router boundary\n${source}\n`]),
        ),
    };
    await createFileTree(sandbox.path, files);
    const eslint = await createEslint(sandbox.path);
    const paths = [
        'public.ts',
        'form-value.js',
        'flat/client.ts',
        'comment.ts',
        'app/api/trpc/route.ts',
        'client/blocked.ts',
        'client/check.test.ts',
        'client/storage.test.ts',
        'app/client.ts',
        'app/child/client.ts',
        ...TRPC_IMPORTS.map((_, index) => `form${String(index)}.ts`),
    ];
    const results = await eslint.lintFiles(paths);
    const expected = new Map([
        ...Object.entries(TRPC_FAILURES),
        ...TRPC_IMPORTS.map(({ line }, index): [string, number] => [`form${String(index)}.ts`, line]),
    ]);
    for (const result of results) {
        const file = result.filePath.slice(sandbox.path.length + 1).replaceAll('\\', '/');
        const findings = result.messages.filter(({ ruleId, fatal }) => ruleId === 'boundaries/dependencies' || fatal);
        const line = expected.get(file);
        expect(
            findings.map(({ ruleId, line }) => ({ ruleId, line })),
            `${level} ${file}`,
        ).toStrictEqual(line === undefined ? [] : [{ ruleId: 'boundaries/dependencies', line }]);
    }
    for (const file of TRPC_IMPORTS.map((_, index) => `form${String(index)}.ts`)) {
        const corrected = await eslint.lintText(TRPC_TYPES, { filePath: file });
        expect(
            corrected.flatMap(({ messages }) =>
                messages.filter(({ ruleId, fatal }) => ruleId === 'boundaries/dependencies' || fatal),
            ),
        ).toStrictEqual([]);
    }
    const malformed = await eslint.lintText('import { broken from "./private/router.js";\n', {
        filePath: 'form0.ts',
    });
    expect(malformed.flatMap(({ messages }) => messages.filter(({ fatal }) => fatal))).toMatchObject([{ fatal: true }]);
    for (const [file, source] of Object.entries(files))
        expect(await Bun.file(join(sandbox.path, file)).text()).toBe(source);
});
