import type { GeneratorOutput } from '#cli/types/manifests.ts';
import type { Substitutions } from '#cli/types/runs/command.ts';

export type GeneratorRun = {
    substitutions: Substitutions;
    commandText: string;
    declaration: string[];
    patterns: string[];
    named: string[];
    targets: GeneratorOutput[];
    selected: string[];
};
