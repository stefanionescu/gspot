import { STRICT_COMPILER_OPTIONS } from '#tests/data/checks/typescript/projects.ts';

const NESTJS_CONTROLLER = `// The routes that greet.
import { GreetingService } from './greeting.service.js';
import { Get, Param, Controller } from '@nestjs/common';

/** Answers greeting requests. */
@Controller('greetings')
export class GreetingController {
    /**
     * Takes the service that builds greetings.
     * @param greetings dependency that formats the response
     */
    constructor(private readonly greetings: GreetingService) {}

    /**
     * Greets the person the route names.
     * @param name route text to trim and include in the response
     * @returns trimmed visitor text with a hello prefix
     */
    @Get(':name')
    greet(@Param('name') name: string): string {
        return this.greetings.greet(name);
    }
}
`;

const NESTJS_SANDBOX = {
    configurations: ['typescript', 'nestjs'],
    tsconfig: {
        compilerOptions: { ...STRICT_COMPILER_OPTIONS, experimentalDecorators: true, emitDecoratorMetadata: true },
        include: ['src'],
    },
    files: {
        'src/greeting.service.ts': `// The greetings the service knows.
import { Injectable } from '@nestjs/common';

/** Builds greetings. */
@Injectable()
export class GreetingService {
    /**
     * Greets one person.
     * @param name route text to trim and include in the response
     * @returns trimmed visitor text with a hello prefix
     */
    greet(name: string): string {
        if (name.trim() === '') {
            throw new Error('A greeting requires a name.');
        }
        return \`hello \${name.trim()}\`;
    }
}
`,
        'src/greeting.controller.ts': NESTJS_CONTROLLER,
        'src/greeting.module.ts': `// The greeting feature.
import { Module } from '@nestjs/common';
import { GreetingService } from './greeting.service.js';
import { GreetingController } from './greeting.controller.js';

/** Wires the greeting feature together. */
@Module({ controllers: [GreetingController], providers: [GreetingService] })
export class GreetingModule {}
`,
    },
} as const;

const NESTJS_CASES = [
    {
        check: 'javascript/eslint',
        files: {
            'src/greeting.controller.ts': `// The routes that greet.
import { GreetingService } from './greeting.service.js';
import { Get, Param, Controller } from '@nestjs/common';

/** Answers greeting requests. */
@Controller('greetings')
export class GreetingController {
    /**
     * Takes the service that builds greetings.
     * @param greetings dependency that formats the response
     */
    constructor(private readonly greetings: GreetingService) {}

    /**
     * Greets the person the route names.
     * @param name route text to trim and include in the response
     * @returns trimmed visitor text with a hello prefix
     */
    @Get(':name')
    greet(@Param('other') name: string): string {
        return this.greetings.greet(name);
    }
}
`,
        },
        corrected: { files: { 'src/greeting.controller.ts': NESTJS_CONTROLLER } },
        expected: {
            file: 'src/greeting.controller.ts',
            rule: '@darraghor/nestjs-typed/param-decorator-name-matches-route-param',
            line: 20,
        },
    },
] as const;

export { NESTJS_CASES, NESTJS_SANDBOX };
