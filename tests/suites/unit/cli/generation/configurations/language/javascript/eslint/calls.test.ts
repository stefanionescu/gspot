import ts from 'typescript';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/planning/session.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { CONFIG_FILE_PROJECT } from '#tests/config/generation/configs.ts';

test('generated ESLint modules hold static imports and calls without executable expressions', async () => {
    const configurations = [...readConfigurations().keys()];
    await using sandbox = await testdir({
        ...CONFIG_FILE_PROJECT,
        'gspot.toml': buildSandboxSettings(configurations, { level: 'all' }),
    });
    const files = buildGeneratedFiles(await openSession(sandbox.path)).files.filter((file) =>
        file.path.endsWith('/eslint.mjs'),
    );
    expect(files.length).toBeGreaterThan(1);
    for (const file of files) {
        const source = ts.createSourceFile(file.path, file.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
        expect(source.statements.slice(0, -1).every((statement) => ts.isImportDeclaration(statement))).toBe(true);
        const last = source.statements.at(-1);
        expect(last !== undefined && ts.isExportAssignment(last) && ts.isArrayLiteralExpression(last.expression)).toBe(
            true,
        );
        const pending: ts.Node[] = [source];
        while (pending.length > 0) {
            const node = pending.pop()!;
            expect(
                [
                    ts.isPropertyAccessExpression(node),
                    ts.isElementAccessExpression(node),
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
