const NESTJS_CONTROLLER = `// The routes that greet.
import { GreetingService } from './greeting.service.js';
import { Get, Param, Controller } from '@nestjs/common';

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

export const NESTJS_CONTROLLER_UNSUPPRESSED = NESTJS_CONTROLLER.replaceAll(
    /^ {4}\/\/ eslint-disable-next-line gspot\/no-trivial-functions -- reason: .*\n/gmu,
    '',
);

const NESTJS_DIRECTIVE_FINDINGS = [
    {
        file: 'src/greeting.controller.ts',
        line: 15,
        column: 5,
        message: "Unused eslint-disable directive (no problems were reported from 'gspot/no-trivial-functions').",
    },
    {
        file: 'src/greeting.controller.ts',
        line: 25,
        column: 5,
        message: "Unused eslint-disable directive (no problems were reported from 'gspot/no-trivial-functions').",
    },
] as const;

export const NESTJS_CASES = [
    {
        name: 'a route parameter decorator names its route parameter',
        rules: ['@darraghor/nestjs-typed/param-decorator-name-matches-route-param'],
        check: 'javascript/eslint',
        files: {
            'src/greeting.controller.ts': NESTJS_CONTROLLER_UNSUPPRESSED.replace("@Param('name')", "@Param('other')"),
        },
        corrected: { files: { 'src/greeting.controller.ts': NESTJS_CONTROLLER_UNSUPPRESSED } },
        expected: {
            file: 'src/greeting.controller.ts',
            rule: '@darraghor/nestjs-typed/param-decorator-name-matches-route-param',
            line: 24,
        },
    },
    {
        name: 'class constructors and methods need no trivial-function suppression',
        rules: [undefined, undefined],
        check: 'javascript/eslint',
        files: { 'src/greeting.controller.ts': NESTJS_CONTROLLER },
        corrected: { files: { 'src/greeting.controller.ts': NESTJS_CONTROLLER_UNSUPPRESSED } },
        expected: NESTJS_DIRECTIVE_FINDINGS[0],
        findings: NESTJS_DIRECTIVE_FINDINGS,
    },
] as const;
