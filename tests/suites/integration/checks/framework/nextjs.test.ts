import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { JSON_INDENT } from '#cli/config/text.ts';
import { type Sandbox } from '#tests/types/sandbox.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { tsconfigSchema } from '#tests/schemas/tsconfig.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { type RunReport } from '#cli/types/commands/check.ts';
import { readTsconfig } from '#cli/parsers/projects/tsconfig.ts';
import { changeSandbox } from '#tests/setup/sandboxes/changes.ts';
import nextPackage from 'next/package.json' with { type: 'json' };
import workspacePackage from '#root-package' with { type: 'json' };
import reactPackage from 'react/package.json' with { type: 'json' };
import testsPackage from '#tests/package.json' with { type: 'json' };
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import reactDomPackage from 'react-dom/package.json' with { type: 'json' };
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    NEXT_PACKAGE,
    NEXTJS_SANDBOX,
    REFERENCE_PROJECT_FILES,
    REFERENCED_PROJECT_FINDING,
} from '#tests/config/integration/checks/framework/nextjs.ts';

async function readCheckReport(sandbox: Sandbox, checks: string[], code: number): Promise<RunReport> {
    const result = parseCheckReport(await spawnGspot(sandbox.root, ['check', '--only', checks.join(','), '--json']));
    expect(result.code, result.stdout + result.stderr).toBe(code);
    return result.report;
}

const dependencies = Object.fromEntries(
    Object.entries({
        next: nextPackage.version,
        ...NEXT_PACKAGE.dependencies,
        react: reactPackage.version,
        'react-dom': reactDomPackage.version,
        typescript: testsPackage.devDependencies.typescript,
        '@types/react': testsPackage.devDependencies['@types/react'],
        '@types/node': workspacePackage.devDependencies['@types/node'],
    }).toSorted(([left], [right]) => left.localeCompare(right)),
);

const installedSandbox = shareInstalledSandbox({
    ...NEXTJS_SANDBOX,
    dependencies,
    files: {
        ...NEXTJS_SANDBOX.files,
        'package.json': JSON.stringify({ ...NEXT_PACKAGE, dependencies }, null, JSON_INDENT) + '\n',
    },
});

test('nextjs/tsc generates types and checks a referenced project without writing build output', async () => {
    const { root } = installedSandbox();
    const parsed = readTsconfig(root, join(root, 'tsconfig.json'), createReadCache(root))!.raw;
    const authored = JSON.stringify({
        ...parsed,
        references: [{ path: './compiler-ref' }],
        exclude: [...(tsconfigSchema.parse(parsed).exclude ?? []), 'compiler-ref/**'],
    });
    await using _sourceChange = await changeSandbox(installedSandbox(), {
        files: { ...REFERENCE_PROJECT_FILES, 'tsconfig.json': authored },
    });
    const failed = await readCheckReport(installedSandbox(), ['nextjs/tsc'], 1);
    expect(failed.checks).toMatchObject([
        { check: 'nextjs/tsc', status: 'failed', findings: [REFERENCED_PROJECT_FINDING] },
    ]);
    await writeFile(join(root, 'compiler-ref/source.ts'), 'export const value: number = 1;\n');
    const passed = await readCheckReport(installedSandbox(), ['nextjs/tsc'], 0);
    expect(passed.checks).toMatchObject([{ check: 'nextjs/tsc', status: 'passed', findings: [] }]);
    expect(await readFile(join(root, 'tsconfig.json'), 'utf8')).toBe(authored);
    expect(await readFile(join(root, 'compiler-ref/tsconfig.json'), 'utf8')).toBe(
        REFERENCE_PROJECT_FILES['compiler-ref/tsconfig.json'],
    );
    expect(await isOnDisk(join(root, 'compiler-ref/dist/source.js'))).toBe(false);
    expect(await isOnDisk(join(root, 'compiler-ref/tsconfig.tsbuildinfo'))).toBe(false);
});
