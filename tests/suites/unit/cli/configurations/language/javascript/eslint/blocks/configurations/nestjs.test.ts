import { expect, test } from 'bun:test';

import { STRICT_COMPILER_OPTIONS } from '#tests/config/setup/languages.ts';
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';

const NESTJS_CONTROLLER = `// The routes that greet.
import { Controller, Get, Param } from '@nestjs/common';

import { GreetingService } from './greeting.service.js';

/**
Answers greeting requests.
*/
@Controller('greetings')
export class GreetingController {
    /**
    Takes the service that builds greetings.

    @param greetings dependency that formats the response
    */
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: NestJS injects the service through this constructor.
    constructor(private readonly greetings: GreetingService) {}

    /**
    Greets the person the route names.

    @param name route text to trim and include in the response
    @returns trimmed visitor text with a hello prefix
    */
    @Get(':name')
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: NestJS routes each request to this method.
    greet(@Param('name') name: string): string {
        return this.greetings.greet(name);
    }
}
`;

const NESTJS_CONTROLLER_UNSUPPRESSED = NESTJS_CONTROLLER.replaceAll(
    /^ {4}\/\/ eslint-disable-next-line gspot\/no-trivial-functions -- reason: .*\n/gmu,
    '',
);

const NESTJS_SANDBOX = {
    configurations: ['typescript', 'nestjs'],
    json: {
        'tsconfig.json': {
            compilerOptions: { ...STRICT_COMPILER_OPTIONS, experimentalDecorators: true, emitDecoratorMetadata: true },
            include: ['src'],
        },
    },
    files: {
        'src/greeting.service.ts': `// The greetings the service knows.
import { Injectable } from '@nestjs/common';

/**
Builds greetings.
*/
@Injectable()
export class GreetingService {
    /**
    Greets one person.

    @param name route text to trim and include in the response
    @returns trimmed visitor text with a hello prefix
    */
    greet(name: string): string {
        if (name.trim() === '') {
            throw new Error('A greeting requires a name.');
        }
        return \`hello \${name.trim()}\`;
    }
}
`,
        'src/greeting.controller.ts': NESTJS_CONTROLLER_UNSUPPRESSED,
        'src/greeting.module.ts': `// The greeting feature.
import { Module } from '@nestjs/common';

import { GreetingController } from './greeting.controller.js';
import { GreetingService } from './greeting.service.js';

/**
Wires the greeting feature together.
*/
@Module({ controllers: [GreetingController], providers: [GreetingService] })
export class GreetingModule {}
`,
    },
} as const;

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
