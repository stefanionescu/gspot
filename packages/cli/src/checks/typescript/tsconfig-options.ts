// Are the required compiler options on in every tsconfig the scope's TypeScript files belong to?
import { join } from 'node:path';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import type { CompilerOptions } from 'typescript';
import { getTsconfig } from '#cli/repository/tsconfig.ts';

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

function missingOptions(input: EngineInput, path: string, options: CompilerOptions): Finding[] {
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
        const parsed = getTsconfig(join(input.root, path));
        if (parsed !== undefined) return missingOptions(input, path, parsed.options);
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
