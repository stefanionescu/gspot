import { z } from 'zod';
import { posix } from 'node:path';
import { isRecord } from '#cli/system/values.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import type { Finding, CheckInput } from '#cli/types/runs/check.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import { readPackageFields } from '#cli/checks/dependencies/package-json.ts';
import { MISE_FILES, NPM_TOOL_PREFIX } from '#cli/config/checks/dependencies.ts';

const miseToolsSchema = z.looseObject({ tools: z.record(z.string(), z.unknown()).default({}) });

function readPinnedVersion(value: unknown): string | undefined {
    const first: unknown = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string') return first;
    const version = isRecord(first) ? first['version'] : undefined;
    return typeof version === 'string' ? version : undefined;
}

function readMisePin(input: CheckInput, path: string, tool: string): string | undefined {
    const text = readCachedText(input.reads, path);
    if (text === undefined) return undefined;
    const { tools } = miseToolsSchema.parse(parseToml(text));
    return readPinnedVersion(tools[tool] ?? tools[`${NPM_TOOL_PREFIX}${tool}`]);
}

function findMisePin(input: CheckInput, folder: string, tool: string): { path: string; version: string } | undefined {
    const segments = folder === '' ? [] : folder.split('/');
    const paths = Array.from({ length: segments.length + 1 }, (_value, index) =>
        segments.slice(0, segments.length - index).join('/'),
    ).flatMap((base) => MISE_FILES.map((file) => posix.join(base, file)));
    for (const path of paths) {
        const version = readMisePin(input, path, tool);
        if (version !== undefined) return { path, version };
    }
    return undefined;
}

function splitPackageManager(field: string | undefined): { tool: string; version: string } | undefined {
    const declared = field?.split('+', 1)[0] ?? '';
    const separator = declared.lastIndexOf('@');
    return separator <= 0 ? undefined : { tool: declared.slice(0, separator), version: declared.slice(separator + 1) };
}

/**
 * Reports a packageManager field that names another version than the mise pin of the same package manager.
 *
 * @param input the scope and the run cache.
 * @returns a finding when the two versions differ.
 */
export function checkPackageManagerPin(input: CheckInput): Finding[] {
    const folder = input.selection.scope.path;
    const manifest = posix.join(folder, PACKAGE_JSON);
    const declared = splitPackageManager(readPackageFields(input, manifest)?.packageManager);
    if (declared === undefined) return [];
    const { tool, version } = declared;
    const pin = findMisePin(input, folder, tool);
    if (pin === undefined || pin.version === version) return [];
    return [
        buildFinding(
            input,
            { file: manifest, line: 1 },
            'package-manager-pin',
            `packageManager names ${tool} ${version}, but ${pin.path} pins ${tool} ${pin.version}. Write one version in both.`,
        ),
    ];
}
