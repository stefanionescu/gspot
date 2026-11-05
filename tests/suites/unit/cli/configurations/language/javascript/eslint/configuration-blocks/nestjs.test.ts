import { expect, test } from 'bun:test';

import { NESTJS_SANDBOX } from '#tests/config/setup/languages.ts';
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';

test.each([
    { name: 'without', swagger: {}, expected: [] },
    {
        name: 'with',
        swagger: { '@nestjs/swagger': '11.2.3' },
        expected: [
            { rule: '@darraghor/nestjs-typed/controllers-should-supply-api-tags', line: 10 },
            { rule: '@darraghor/nestjs-typed/api-method-should-specify-api-response', line: 24 },
        ],
    },
])('a package.json $name @nestjs/swagger decides the Swagger lint rules', async ({ swagger, expected }) => {
    await using repository = await createSandbox({
        ...NESTJS_SANDBOX,
        level: 'all',
        dependencies: { '@nestjs/common': SANDBOX_PACKAGES['@nestjs/common'], ...swagger },
    });
    const findings = await listLintFindings(
        await buildEslint(repository.root),
        repository.root,
        ['src/greeting.controller.ts'],
        [
            '@darraghor/nestjs-typed/controllers-should-supply-api-tags',
            '@darraghor/nestjs-typed/api-method-should-specify-api-response',
        ],
    );
    expect(findings.map(({ rule, line }) => ({ rule, line }))).toStrictEqual([...expected]);
});
