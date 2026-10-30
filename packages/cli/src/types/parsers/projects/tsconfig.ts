import type { z } from 'zod';
import type ts from 'typescript';
import type { tsconfigSchema } from '#cli/schemas/parsers/projects/tsconfig.ts';

export type ParsedTsconfig = Omit<ts.ParsedCommandLine, 'raw'> & {
    raw: z.infer<typeof tsconfigSchema>;
    tsconfigFiles: string[];
    extendedTsconfigFiles: string[];
};

export type TypeScriptProject = {
    path: string;
    config: ParsedTsconfig;
    projects: Map<string, ParsedTsconfig>;
};
