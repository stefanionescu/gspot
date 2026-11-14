import { isDeepStrictEqual } from 'node:util';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { compareText } from '#cli/system/text/order.ts';
import { uvLockfileSchema } from '#cli/schemas/tools.ts';
import { tryParseFile } from '#cli/parsers/validation.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/parse.ts';
import { normalizePythonName } from '#cli/parsers/projects/dependencies.ts';
import type { UvLockfile, PythonToolProject, PythonIndexSettings } from '#cli/types/tools.ts';

import {
    PYTHON_PACKAGE_ORIGINS,
    REQUIREMENT_PACKAGE_NAME,
    PYTHON_DEFAULT_INDEX_ORIGIN,
} from '#cli/config/tools/installers.ts';

function parseExactRequirements(lockedPackage: UvLockfile['package'][number]): string[] | undefined {
    const requirements = lockedPackage.metadata?.['requires-dist'] ?? [];
    const pins: string[] = [];
    for (const { name, specifier } of requirements) {
        if (specifier === undefined) return undefined;
        pins.push(`${normalizePythonName(name)}${specifier}`);
    }
    return pins;
}

function parsePythonToolLockfile(lockfile: string, minimumReleaseAge?: number): UvLockfile | undefined {
    const parsed = tryParseFile(() => parseTomlFile(GSPOT_PATHS.uvLockfile, lockfile, uvLockfileSchema));
    if (parsed?.version !== 1) return undefined;
    return minimumReleaseAge === undefined ||
        parsed.options?.['exclude-newer-span'] === `P${String(minimumReleaseAge)}D`
        ? parsed
        : undefined;
}

function hasAllowedPythonOrigins(lockfile: UvLockfile, indexes: PythonIndexSettings['settings']): boolean {
    const configured = [
        ...(indexes.index ?? []).map((index) => index.url),
        ...(indexes['index-url'] === undefined ? [] : [indexes['index-url']]),
        ...(indexes['extra-index-url'] ?? []),
        ...(indexes['find-links'] ?? []),
    ];
    const hasDefaultIndexOverride =
        indexes['index-url'] !== undefined || indexes.index?.some((index) => index.default === true) === true;
    const origins = new Set(
        [...PYTHON_PACKAGE_ORIGINS, ...(hasDefaultIndexOverride ? [] : [PYTHON_DEFAULT_INDEX_ORIGIN]), ...configured]
            .filter((url) => URL.canParse(url))
            .map((url) => new URL(url).origin),
    );
    return lockfile.package
        .flatMap(({ source, sdist, wheels = [] }) => [
            source?.registry,
            sdist?.url,
            ...wheels.map((wheel) => wheel.url),
        ])
        .filter((address) => address !== undefined)
        .every((address) =>
            URL.canParse(address) ? origins.has(new URL(address).origin) : configured.includes(address),
        );
}

export function isPythonLockfileFresh(
    project: PythonToolProject,
    lockfile: string | undefined,
    indexes?: PythonIndexSettings['settings'],
    minimumReleaseAge?: number,
): boolean {
    if (lockfile === undefined) return false;
    const saved = parsePythonToolLockfile(lockfile, minimumReleaseAge);
    if (saved === undefined) return false;
    if (indexes !== undefined && !hasAllowedPythonOrigins(saved, indexes)) return false;
    const projectPackage = saved.package.find(
        (lockedPackage) => lockedPackage.name === project.name && lockedPackage.source?.virtual === '.',
    );
    if (projectPackage === undefined || saved['requires-python'] !== project['requires-python']) return false;
    const pins = parseExactRequirements(projectPackage);
    if (pins === undefined) return false;
    const expected = project.dependencies
        .map((value) => value.replace(REQUIREMENT_PACKAGE_NAME, (name) => normalizePythonName(name)))
        .toSorted((left, right) => compareText(left, right));
    return isDeepStrictEqual(
        pins.toSorted((left, right) => compareText(left, right)),
        expected,
    );
}
