import { join } from 'node:path';
import type { CompilerOptions } from 'typescript';
import type { Finding } from '#cli/checks/result.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { getTsconfig } from '#cli/repository/tsconfig.ts';
import { ALL_COMPILER_OPTIONS } from '#cli/checks/typescript/compiler-options.ts';

// Nest injects by the emitted types of constructor parameters, which takes both decorator options.
const DECORATOR_OPTIONS = { experimentalDecorators: true, emitDecoratorMetadata: true };

function isTsconfigName(path: string): boolean {
    const name = path.slice(path.lastIndexOf('/') + 1);
    return name === 'tsconfig.json' || (name.startsWith('tsconfig.') && name.endsWith('.json'));
}

function missingOptions(input: EngineInput, path: string, options: CompilerOptions): Finding[] {
    const required = input.view.configurations.includes('nestjs')
        ? { ...ALL_COMPILER_OPTIONS, ...DECORATOR_OPTIONS }
        : ALL_COMPILER_OPTIONS;
    return Object.keys(required)
        .filter((option) => options[option] !== true)
        .map((option) => ({
            check: input.spec.name,
            file: path,
            rule: option,
            message: `${option} is not on in this tsconfig.`,
            help: 'Enable this compiler option in the authored TypeScript configuration.',
            fixable: false,
        }));
}

/**
 * One finding per required option a scope's tsconfig leaves off.
 * @param input the engine input for the scope
 * @returns the findings
 */
export function tsconfigOptions(input: EngineInput): Finding[] {
    const scopeTsconfig = input.scope === '' ? 'tsconfig.json' : `${input.scope}/tsconfig.json`;
    const candidates = new Set([scopeTsconfig, ...input.files.map((file) => file.path).filter(isTsconfigName)]);
    return [...candidates].flatMap((path) => {
        const parsed = getTsconfig(input.root, join(input.root, path));
        if (parsed !== undefined) return missingOptions(input, path, parsed.options);
        if (path !== scopeTsconfig) return [];
        return [
            {
                check: input.spec.name,
                file: path,
                message:
                    'This scope has no tsconfig.json. Add an authored TypeScript configuration for its source files.',
                fixable: false,
            },
        ];
    });
}
