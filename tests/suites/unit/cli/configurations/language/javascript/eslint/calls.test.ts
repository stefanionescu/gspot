import ts from 'typescript';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { CONFIG_PROJECT } from '#tests/config/setup/configurations.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('generated ESLint modules hold static imports and calls without executable expressions', async () => {
    const configurations = [...readConfigurations().keys()];
    await using sandbox = await createGitSandbox({
        ...CONFIG_PROJECT,
        'gspot.toml': buildSandboxSettings(configurations, { level: 'all' }),
    });
    const files = buildGeneratedFiles(await openSession(sandbox.path)).files.filter((file) =>
        file.path.endsWith('/eslint.mjs'),
    );
    expect(files.length).toBeGreaterThan(1);
    for (const file of files) {
        const source = ts.createSourceFile(file.path, file.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
        expect(
            source.statements
                .slice(0, -1)
                .every((statement) => ts.isImportDeclaration(statement) || ts.isVariableStatement(statement)),
        ).toBe(true);
        const last = source.statements.at(-1);
        expect(last !== undefined && ts.isExportAssignment(last)).toBe(true);
        const pending: ts.Node[] = [source];
        while (pending.length > 0) {
            const node = pending.pop()!;
            expect(
                [
                    ts.isPropertyAccessExpression(node),
                    ts.isConditionalExpression(node),
                    ts.isBinaryExpression(node),
                    ts.isArrowFunction(node),
                ].some(Boolean),
            ).toBe(false);
            ts.forEachChild(node, (child) => {
                pending.push(child);
            });
        }
    }
});

test('a large repository prints the runtime table and the boundary folders once, and merges equal blocks', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"private":true,"type":"module"}\n',
        'first/app.jsx': 'export const name = "first";\n',
        'second/app.jsx': 'export const name = "second";\n',
        'third/app.jsx': 'export const name = "third";\n',
        'gspot.toml': buildSandboxSettings(['javascript'], {
            scopes: [
                { path: 'first', configurations: ['react'] },
                { path: 'second', configurations: ['react'] },
                { path: 'third', configurations: ['react'] },
            ],
        }),
    });
    const { files } = buildGeneratedFiles(await openSession(sandbox.path));
    const main = files.find((file) => file.path.endsWith('/javascript/eslint/eslint.mjs'))!.content;
    expect(main.match(/const runtimeDeclarations = /gu)).toHaveLength(1);
    expect(main.match(/const importBoundaryFolders = /gu)).toHaveLength(1);
    expect(main).not.toContain('"folders": [');
    const react = files.find((file) => file.path.endsWith('/react/eslint.mjs'))!.content;
    expect(react.match(/mergePresetRules\(/gu)).toHaveLength(2);
});
