// Are the required compiler options on in every tsconfig the scope's TypeScript files belong to?
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { dirname, join, resolve } from 'node:path';
import type { Tsconfig } from '#types/integrity.ts';
import { parseJsonc } from '#cli/repository/jsonc.ts';

const REQUIRED = [
    'strict',
    'noUncheckedIndexedAccess',
    'exactOptionalPropertyTypes',
    'noImplicitOverride',
    'forceConsistentCasingInFileNames',
    'noImplicitReturns',
    'noFallthroughCasesInSwitch',
    'verbatimModuleSyntax',
    'erasableSyntaxOnly',
    'noPropertyAccessFromIndexSignature',
];

const DECORATOR_CLASHES = new Set(['verbatimModuleSyntax', 'erasableSyntaxOnly']);
const DECORATOR_OPTIONS = ['experimentalDecorators', 'emitDecoratorMetadata'];

function readTsconfig(path: string): Tsconfig | undefined {
    try {
        return tsconfigSchema.parse(parseJsonc(readFileSync(path, 'utf8')));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot read TypeScript configuration ${path}: ${detail}`, { cause: error });
    }
}

function basesOf(parsed: Tsconfig): string[] {
    if (parsed.extends === undefined) return [];
    return Array.isArray(parsed.extends) ? parsed.extends : [parsed.extends];
}

function baseFile(path: string, base: string): string {
    const target = base.startsWith('.') ? resolve(dirname(path), base) : join(dirname(path), 'node_modules', base);
    return target.endsWith('.json') ? target : `${target}.json`;
}

function resolvedOptions(path: string, parsed: Tsconfig, seen = new Set<string>()): Record<string, unknown> {
    if (seen.has(path)) throw new Error(`Circular TypeScript configuration inheritance at ${path}.`);
    seen.add(path);
    let options: Record<string, unknown> = {};
    for (const base of basesOf(parsed)) {
        const inheritedPath = baseFile(path, base);
        const inherited = readTsconfig(inheritedPath);
        if (inherited === undefined)
            throw new Error(`Extended TypeScript configuration ${inheritedPath} does not exist.`);
        options = { ...options, ...resolvedOptions(inheritedPath, inherited, seen) };
    }
    seen.delete(path);
    return { ...options, ...parsed.compilerOptions };
}

function isTsconfigName(path: string): boolean {
    const name = path.slice(path.lastIndexOf('/') + 1);
    return name === 'tsconfig.json' || (name.startsWith('tsconfig.') && name.endsWith('.json'));
}

// NestJS injects by the types of constructor parameters. That needs decorators with emitted metadata, which
// verbatimModuleSyntax refuses, and parameter properties, which erasableSyntaxOnly refuses.
function requiredFor(input: EngineInput): string[] {
    const selected = input.session.scopes.find((entry) => entry.scope.path === input.scope)?.selected ?? [];
    if (selected.every((manifest) => manifest.preset.name !== 'nestjs')) return REQUIRED;
    return [...REQUIRED.filter((option) => !DECORATOR_CLASHES.has(option)), ...DECORATOR_OPTIONS];
}

function missingOptions(input: EngineInput, path: string, parsed: Tsconfig): Finding[] {
    const options = resolvedOptions(join(input.root, path), parsed);
    return requiredFor(input)
        .filter((option) => options[option] !== true)
        .map((option) => ({
            check: input.spec.name,
            file: path,
            rule: option,
            message: `${option} is not on in this tsconfig.`,
            help: 'Keep extends pointing at .gspot/tsconfig.base.json and do not override the strict options.',
            fixable: false,
        }));
}

const configText = z.string();

/** The TypeScript configuration fields used by the option check. */
export const tsconfigSchema = z.object({
    extends: z.union([configText, z.array(configText)]).optional(),
    compilerOptions: z.record(configText, z.unknown()).optional(),
});

/**
 * One finding per required option a scope's tsconfig leaves off.
 * @param input the engine input for the scope
 * @returns the findings
 */
export function tsconfigOptions(input: EngineInput): Promise<Finding[]> {
    const scopeTsconfig = input.scope === '' ? 'tsconfig.json' : `${input.scope}/tsconfig.json`;
    const candidates = new Set([
        scopeTsconfig,
        ...input.files.map((file) => file.path).filter((path) => isTsconfigName(path)),
    ]);
    const findings = [...candidates].flatMap((path) => {
        const parsed = readTsconfig(join(input.root, path));
        if (parsed !== undefined) return missingOptions(input, path, parsed);
        if (path !== scopeTsconfig) return [];
        return [
            {
                check: input.spec.name,
                file: path,
                message:
                    'This scope has no tsconfig.json; run gspot apply to write the stub that extends the shipped base.',
                fixable: true,
            },
        ];
    });
    return Promise.resolve(findings);
}
