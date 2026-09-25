import { describe, expect, test } from 'bun:test';
import { identifiersOf } from '#cli/checks/naming/extract.ts';

const TS = `
export function parseHttpUrl(rawInput: string, { retries = 3, ...rest }: Options, [first, second]: string[]): void {}
const enhancedHandler = (event) => {};
let { data: payload } = source;
class HttpClient extends Base {
    #secret = 1;
    static readonly DEFAULT_PORT = 80;
    constructor(private readonly baseUrl: string) {}
    async send(body: Body): Promise<void> {}
}
interface Options { retries?: number; 'Content-Type': string }
type Verdict = 'ok';
enum Mode { Fast, Slow = 2 }
const table = { keyOne: 1 };
`;

describe('identifiersOf', () => {
    test('collects TypeScript declarations by category and skips object literal keys', async () => {
        const found = await identifiersOf('src/a.ts', TS, 'typescript');
        const byCategory = (category: string): string[] =>
            found.filter((entry) => entry.category === category).map((entry) => entry.name);
        expect(byCategory('functions')).toStrictEqual(['parseHttpUrl']);
        expect(byCategory('parameters')).toStrictEqual([
            'rawInput',
            'retries',
            'rest',
            'first',
            'second',
            'event',
            'baseUrl',
            'body',
        ]);
        expect(byCategory('variables')).toStrictEqual(['enhancedHandler', 'payload', 'table']);
        expect(byCategory('classes')).toStrictEqual(['HttpClient']);
        expect(byCategory('properties')).toStrictEqual(['secret', 'DEFAULT_PORT', 'baseUrl', 'retries']);
        expect(byCategory('methods')).toStrictEqual(['send']);
        expect(byCategory('types')).toStrictEqual(['Options', 'Verdict', 'Mode']);
        expect(byCategory('enum_cases')).toStrictEqual(['Fast', 'Slow']);
        expect(found.map((entry) => entry.name)).not.toContain('keyOne');
        expect(found.find((entry) => entry.name === 'send')?.line).toBe(9);
    });

    test('collects shell functions and variables', async () => {
        const found = await identifiersOf(
            'scripts/run.sh',
            'readonly ROOT=1\nlocal count\nbuild_all() {\n  TARGET=x\n}\n',
            'bash',
        );
        expect(found.map((entry) => `${entry.category}:${entry.name}`)).toStrictEqual([
            'variables:ROOT',
            'variables:count',
            'functions:build_all',
            'variables:TARGET',
        ]);
    });

    test('a language without an extractor yields nothing', async () => {
        expect(await identifiersOf('a.rb', 'x = 1', 'ruby')).toStrictEqual([]);
    });
});
