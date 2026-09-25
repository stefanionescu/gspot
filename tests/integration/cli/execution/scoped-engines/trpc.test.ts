import { run } from '#tests/support/cli/command.ts';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

test.each([
    'import { router } from "./private/router.js";',
    'import {\n router\n} from "./private/router.js";',
    'export { router } from "./private/router.js";',
    'const router = require("./private/router.js");',
    'const router = import("./private/router.js");',
    'import { router } from "#private/router";',
])('tRPC resolves the configured server boundary for %s and permits type-only imports', async (statement) => {
    await using sandbox = await testdir();
    const policy = 'version = 1\nconfigurations = ["trpc"]\n[tools.trpc]\nserver_files = ["private/**"]\n';
    const source = `// A comment mentioning import from private is not an edge.\n${statement}\n`;
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'package.json': '{"imports":{"#private/*":"./private/*.ts"}}',
        'private/router.ts': 'export const router = {};\n',
        'client.ts': source,
        'server-public/unrelated.ts': 'export const publicValue = 1;\n',
        'public.ts': 'import {publicValue} from "./server-public/unrelated.js";\n',
    });
    const command = ['check', '--only', 'trpc/router-boundaries', '--no-cache', '--json'];
    const failed = await run(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const findings = JSON.parse(failed.stdout).checks.flatMap((entry: { findings: unknown[] }) => entry.findings);
    expect(findings).toMatchObject([{ file: 'client.ts', line: 2, rule: 'server-import' }]);
    expect(findings).toHaveLength(1);
    await Bun.write(
        `${sandbox.path}/client.ts`,
        'import type { router } from "./private/router.js";\nimport { type router as Router } from "./private/router.js";\n',
    );
    const corrected = await run(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(await Bun.file(`${sandbox.path}/gspot.toml`).text()).toBe(policy);
    expect(await Bun.file(`${sandbox.path}/public.ts`).text()).toBe(
        'import {publicValue} from "./server-public/unrelated.js";\n',
    );
});

test('tRPC architecture boundaries retain source locations, scope isolation, and failed observations', async () => {
    await using sandbox = await testdir();
    const policy =
        'version = 1\nconfigurations = ["trpc"]\n[architecture]\nelements = [{name = "server", paths = ["private/**"]}]\n[[scope]]\npath = "app"\n[[scope]]\npath = "app/child"\n';
    const source = '// Router boundary\nimport { router } from "./private/router.js";\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'private/router.ts': 'export const router = {};\n',
        'client.ts': 'import { value } from "./server/public.js";\n',
        'server/public.ts': 'export const value = 1;\n',
        'app/private/router.ts': 'export const router = {};\n',
        'app/client.ts': 'import type { router } from "./private/router.js";\n',
        'app/child/private/router.ts': 'export const router = {};\n',
        'app/child/client.ts': source,
    });
    const command = ['check', '--only', 'trpc/router-boundaries', '--no-cache', '--json'];
    const failed = await run(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        JSON.parse(failed.stdout).checks.map(
            (entry: { scope: string; findings: { file: string; line: number }[] }) => ({
                scope: entry.scope,
                findings: entry.findings.map(({ file, line }) => ({ file, line })),
            }),
        ),
    ).toStrictEqual([
        { scope: '', findings: [] },
        { scope: 'app', findings: [] },
        { scope: 'app/child', findings: [{ file: 'app/child/client.ts', line: 2 }] },
    ]);
    await Bun.write(`${sandbox.path}/app/child/client.ts`, 'import { broken from "./private/router.js";\n');
    const malformed = await run(sandbox.path, command);
    expect(malformed.code, malformed.stdout + malformed.stderr).toBe(2);
    expect(malformed.stdout).toContain('Cannot parse imports in app/child/client.ts');
    await Bun.write(`${sandbox.path}/app/child/client.ts`, 'import type { router } from "./private/router.js";\n');
    const corrected = await run(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(await Bun.file(`${sandbox.path}/gspot.toml`).text()).toBe(policy);
    expect(await Bun.file(`${sandbox.path}/server/public.ts`).text()).toBe('export const value = 1;\n');
});
