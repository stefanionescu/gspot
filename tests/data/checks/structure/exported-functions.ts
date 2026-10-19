// Cross-file exports include aliases and namespace imports, and keep shared functions and command definitions.
export const EXPORTED_FUNCTION_FILES = {
    'forward.ts': `export function forward(value: string): string { return value.trim(); }
export const expression = (value: number): number => value + 1;
export function shared(value: string): string { return value.trim(); }
export function command(program: any): void { program.command('example').description('example').action(() => {}); }
export function callback(values: string[]): string[] { return values.map((value) => value.trim()); }
export function local(value: string): string { return value.trim(); }
export const localValue = local(' own file ');
`,
    'namespace.mjs': `export function forward(value) { return value.trim(); }
`,
    'default.cjs': `module.exports = (value) => value + 1;
`,
    'caller.ts': `import { forward, expression as add, shared, command, callback, local } from './forward.ts';
import * as handlers from './namespace.mjs';
import increment from './default.cjs';
forward('one'); add(1); shared('one'); command({}); callback([]); local('one'); handlers.forward('one'); increment(1);
`,
    'other.ts': `import { shared } from './forward.ts'; shared('two');
`,
} as const;
