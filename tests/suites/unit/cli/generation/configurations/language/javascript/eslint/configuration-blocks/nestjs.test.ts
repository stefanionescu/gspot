import { join } from 'node:path';
import type { ESLint } from 'eslint';
import { test, expect } from 'bun:test';
import { readFile, writeFile } from 'node:fs/promises';
import { NESTJS_SANDBOX } from '#tests/config/nestjs.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { toolModules } from '#tests/setup/sandboxes/node-modules.ts';
import { createEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import type { PackageJson } from '#cli/types/parsers/projects/dependencies.ts';

test('the Swagger lint rules apply only when package.json declares @nestjs/swagger', async () => {
    await using repository = await createSandbox({
        ...NESTJS_SANDBOX,
        level: 'all',
        dependencies: { '@nestjs/common': SANDBOX_PACKAGES['@nestjs/common'] },
    });
    const path = join(repository.root, 'src/greeting.controller.ts');
    expect(
        await listLintFindings(
            await createEslint(repository.root),
            repository.root,
            ['src/greeting.controller.ts'],
            [
                '@darraghor/nestjs-typed/controllers-should-supply-api-tags',
                '@darraghor/nestjs-typed/api-method-should-specify-api-response',
            ],
        ),
    ).toStrictEqual([]);
    const packagePath = join(repository.root, 'package.json');
    const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as PackageJson;
    await writeFile(
        packagePath,
        JSON.stringify({ ...packageJson, dependencies: { ...packageJson.dependencies, '@nestjs/swagger': '11.2.3' } }),
    );
    await createEslint(repository.root);
    const swagger = await runCommand([join(toolModules, '.bin/eslint'), '--format', 'json', path], {
        cwd: repository.root,
    });
    const swaggerResults = JSON.parse(swagger.stdout) as ESLint.LintResult[];
    expect(swagger.code, swagger.stdout + swagger.stderr).toBe(1);
    expect(
        swaggerResults.flatMap(({ messages }) =>
            messages
                .filter(({ ruleId }) => ruleId?.startsWith('@darraghor/nestjs-typed/') === true)
                .map(({ ruleId, line }) => ({ ruleId, line })),
        ),
    ).toStrictEqual([
        { ruleId: '@darraghor/nestjs-typed/controllers-should-supply-api-tags', line: 9 },
        { ruleId: '@darraghor/nestjs-typed/api-method-should-specify-api-response', line: 23 },
    ]);
});
