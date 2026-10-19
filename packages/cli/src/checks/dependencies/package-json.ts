// Read the dependency specifiers and the package manager that a package.json declares.
import { z } from 'zod';
import { parseJsonc } from '#cli/parsers/json.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { CheckInput } from '#cli/types/runs/check.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { DEPENDENCY_SECTIONS } from '#cli/config/parsers/lockfiles.ts';
import type { PackageFields } from '#cli/types/checks/dependencies.ts';

const packageJsonSchema = z.looseObject({
    packageManager: z.string().optional(),
    dependencies: z.record(z.string(), z.string()).optional(),
    devDependencies: z.record(z.string(), z.string()).optional(),
    optionalDependencies: z.record(z.string(), z.string()).optional(),
} satisfies SchemaShape<PackageFields>);

/**
 * Read a package.json of the repository.
 * @param input the run cache.
 * @param path the repository-relative path of the package.json.
 * @returns the declared fields, or undefined when the file does not exist.
 */
export function readPackageFields(input: Pick<CheckInput, 'reads'>, path: string): PackageFields | undefined {
    const text = readCachedText(input.reads, path);
    return text === undefined ? undefined : packageJsonSchema.parse(parseJsonc(text));
}

/**
 * Read the specifier of each dependency that a package.json declares for an install.
 * @param input the run cache.
 * @param path the repository-relative path of the package.json.
 * @returns the specifiers by name, or undefined when the file does not exist.
 */
export function readDeclaredSpecifiers(
    input: Pick<CheckInput, 'reads'>,
    path: string,
): Map<string, string> | undefined {
    const fields = readPackageFields(input, path);
    if (fields === undefined) return undefined;
    return new Map(
        DEPENDENCY_SECTIONS.flatMap((section) => {
            const dependencies = fields[section];
            return dependencies === undefined ? [] : Object.entries(dependencies);
        }),
    );
}
