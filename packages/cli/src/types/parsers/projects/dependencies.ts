import type { z } from 'zod';
import type { pipfileSchema, pyprojectSchema, packageJsonSchema } from '#cli/schemas/parsers/projects/dependencies.ts';

export type PackageJson = z.infer<typeof packageJsonSchema>;

export type Dependencies = Record<string, string>;

export type DependencyFile = {
    path: string;
    kind: 'package.json' | 'pyproject.toml' | 'Package.swift' | 'Pipfile' | 'requirements.txt';
    dependencies: Dependencies;
    installed: Dependencies;
    runtimes?: Record<string, string>;
};

export type DependencyFileParser = (path: string, text: string) => DependencyFile | Promise<DependencyFile>;

export type PythonDependency = NonNullable<z.infer<typeof pipfileSchema>['packages']>[string];

export type Pyproject = z.infer<typeof pyprojectSchema>;
