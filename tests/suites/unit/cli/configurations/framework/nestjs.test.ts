import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { STRICT_COMPILER_OPTIONS } from '#tests/config/setup/languages.ts';
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings, readEslintRules } from '#tests/setup/eslint/lint.ts';

test.each([
    { name: 'without', swagger: {}, expected: [] },
    {
        name: 'with',
        swagger: { '@nestjs/swagger': '11.2.3' },
        expected: [
            { rule: '@darraghor/nestjs-typed/controllers-should-supply-api-tags', line: 4 },
            { rule: '@darraghor/nestjs-typed/api-method-should-specify-api-response', line: 5 },
        ],
    },
])('a package.json $name @nestjs/swagger decides the Swagger lint rules', async ({ swagger, expected }) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript', 'nestjs'], { level: 'all' }),
        'package.json': JSON.stringify({
            private: true,
            type: 'module',
            dependencies: { '@nestjs/common': SANDBOX_PACKAGES['@nestjs/common'], ...swagger },
        }),
        'tsconfig.json': JSON.stringify({
            compilerOptions: { ...STRICT_COMPILER_OPTIONS, experimentalDecorators: true, emitDecoratorMetadata: true },
            include: ['src'],
        }),
        'src/greeting.controller.ts': `import { Controller, Get } from '@nestjs/common';

@Controller('greetings')
export class GreetingController {
    @Get(':name')
    greet(): string {
        return 'hello';
    }
}
`,
    });
    const findings = await listLintFindings(
        await buildEslint(sandbox.path),
        sandbox.path,
        ['src/greeting.controller.ts'],
        [
            '@darraghor/nestjs-typed/controllers-should-supply-api-tags',
            '@darraghor/nestjs-typed/api-method-should-specify-api-response',
        ],
    );
    expect(findings.map(({ rule, line }) => ({ rule, line }))).toStrictEqual([...expected]);
});

test('the NestJS injectable rule reads the sources of its own scope', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            scopes: [{ path: 'api', configurations: ['typescript', 'nestjs'] }],
        }),
        'package.json': '{"private":true,"type":"module"}',
        'api/tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src"]}',
        'api/src/main.ts': 'export const value = 1;\n',
    });
    const rules = await readEslintRules(await buildEslint(sandbox.path), ['api/src/main.ts']);
    expect(rules['api/src/main.ts']!['@darraghor/nestjs-typed/injectable-should-be-provided']?.[1]).toMatchObject({
        src: ['api/**/*.ts'],
    });
});
