// Read the dependency specifiers that a lockfile records for each workspace, which a frozen install compares with
// each package.json.
import { z } from 'zod';
import { parse as parseYaml } from 'yaml';
import { isRecord } from '#cli/system/values.ts';
import { parseJsonc } from '#cli/parsers/json.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { DEPENDENCY_SECTIONS, type IMPORTER_LOCKFILES } from '#cli/config/parsers/lockfiles.ts';

const sectionsSchema = z.looseObject(
    Object.fromEntries(
        DEPENDENCY_SECTIONS.map((section) => [section, z.record(z.string(), z.unknown()).optional()]),
    ) as Record<(typeof DEPENDENCY_SECTIONS)[number], z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>,
);

const npmSchema = z.looseObject({ packages: z.record(z.string(), z.unknown()).default({}) } satisfies SchemaShape<{
    packages: Record<string, unknown>;
}>);
const bunSchema = z.looseObject({ workspaces: z.record(z.string(), z.unknown()).default({}) } satisfies SchemaShape<{
    workspaces: Record<string, unknown>;
}>);
const pnpmSchema = z.looseObject({ importers: z.record(z.string(), z.unknown()).default({}) } satisfies SchemaShape<{
    importers: Record<string, unknown>;
}>);

// The specifier of each dependency in one workspace entry. pnpm records { specifier, version } for each.
function readSpecifiers(entry: unknown): Map<string, string> {
    const parsed = sectionsSchema.safeParse(entry);
    if (!parsed.success) return new Map();
    return new Map(
        DEPENDENCY_SECTIONS.flatMap((section) => {
            const dependencies = parsed.data[section];
            if (dependencies === undefined) return [];
            return Object.entries(dependencies).flatMap(([name, value]): [string, string][] => {
                if (typeof value === 'string') return [[name, value]];
                const specifier = isRecord(value) ? value['specifier'] : undefined;
                return typeof specifier === 'string' ? [[name, specifier]] : [];
            });
        }),
    );
}

function toWorkspaceFolder(key: string): string {
    return key === '.' ? '' : key;
}

const READERS: Readonly<Record<(typeof IMPORTER_LOCKFILES)[number], (text: string) => [string, unknown][]>> = {
    // npm keeps each workspace as a package entry at its folder; installed packages live under node_modules.
    'package-lock.json': (text) =>
        Object.entries(npmSchema.parse(parseJsonc(text)).packages).filter(([key]) => !key.includes('node_modules/')),
    'bun.lock': (text) => Object.entries(bunSchema.parse(parseJsonc(text)).workspaces),
    'pnpm-lock.yaml': (text) => Object.entries(pnpmSchema.parse(parseYaml(text)).importers),
};

/**
 * Read the dependency specifiers that a lockfile records for each workspace.
 * @param lockfile the lockfile name, which selects its format.
 * @param text the lockfile contents.
 * @returns the specifiers by dependency name, for each workspace folder relative to the lockfile, '' for its own.
 */
export function readLockedSpecifiers(
    lockfile: (typeof IMPORTER_LOCKFILES)[number],
    text: string,
): Map<string, Map<string, string>> {
    return new Map(READERS[lockfile](text).map(([key, entry]) => [toWorkspaceFolder(key), readSpecifiers(entry)]));
}
