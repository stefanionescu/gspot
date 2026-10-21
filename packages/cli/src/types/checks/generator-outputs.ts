import type { Substitutions } from '#cli/types/runs/command.ts';
import type { GeneratorOutput } from '#cli/types/configurations.ts';

/** A declared generator with resolved paths and command substitutions. */
export type GeneratorRun = {
    values: Substitutions;
    commandText: string;
    declaration: string[];
    patterns: string[];
    named: string[];
    targets: GeneratorOutput[];
    selected: string[];
};
