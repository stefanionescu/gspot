// Reusable policy: source acquisition, validation, and export share one repository-path calculation.
import { readFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { isRecord } from '#cli/platform/objects.ts';
import { parseTomlText } from '#cli/policy/read.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { contentDigest } from '#cli/platform/text.ts';
import { stringify, parse as parseToml } from 'smol-toml';
import type { KeyPath } from '#cli/types/platform/document.ts';
import type { TomlTable } from '#cli/types/policy/settings.ts';
import { templateSchema } from '#cli/policy/schema/templates.ts';
import { unknownConfigurations } from '#cli/configurations/problems.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import type { Template, ExportedTemplate } from '#cli/types/policy/templates.ts';

import {
    RAW_HOST,
    PATH_KEYS,
    GITHUB_PREFIX,
    TEMPLATE_FILE,
    LOCAL_MODULE_PATH,
    REPOSITORY_TABLES,
    REQUEST_TIMEOUT_MS,
    TEMPLATE_EXTENSION,
} from '#cli/config/policy/templates.ts';

function getRepositoryPaths(value: unknown, path: KeyPath = []): KeyPath[] {
    if (Array.isArray(value)) return value.flatMap((item, index) => getRepositoryPaths(item, [...path, index]));
    if (!isRecord(value)) return [];
    return Object.entries(value).flatMap(([key, inner]) => {
        const location = [...path, key];
        const isLocalModule = key === 'module' && typeof inner === 'string' && LOCAL_MODULE_PATH.test(inner);
        return PATH_KEYS.has(key) || isLocalModule ? [location] : getRepositoryPaths(inner, location);
    });
}

function locationText(path: KeyPath): string {
    let text = '';
    for (const key of path) {
        if (typeof key === 'number') text += `[${String(key)}]`;
        else text += text === '' ? key : `.${key}`;
    }
    return text;
}

function containerSize(value: unknown): number | undefined {
    if (Array.isArray(value)) return value.length;
    if (isRecord(value)) return Object.keys(value).length;
    return undefined;
}

// Project the recorded omissions without deciding again which fields name repository paths.
function omitRepositoryPaths(value: unknown, omitted: ReadonlySet<string>, path: KeyPath = []): unknown {
    if (omitted.has(JSON.stringify(path))) return undefined;
    if (Array.isArray(value))
        return value.flatMap((item, index) => {
            const next = omitRepositoryPaths(item, omitted, [...path, index]);
            return next === undefined ? [] : [next];
        });
    if (!isRecord(value)) return value;
    const entries = Object.entries(value).flatMap(([key, inner]): [string, unknown][] => {
        const next = omitRepositoryPaths(inner, omitted, [...path, key]);
        if (next === undefined) return [];
        const previousSize = containerSize(inner);
        if (previousSize !== undefined && previousSize > 0 && containerSize(next) === 0) return [];
        return [[key, next]];
    });
    return Object.fromEntries(entries);
}

function buildGithubUrl(source: string): string {
    const [location = '', ref = 'HEAD'] = source.slice(GITHUB_PREFIX.length).split('@');
    const [owner = '', repository = '', ...rest] = location.split('/');
    const file = rest.length === 0 ? TEMPLATE_FILE : rest.join('/');
    return `${RAW_HOST}/${owner}/${repository}/${ref}/${file}`;
}

async function getRemoteText(url: string): Promise<string> {
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) throw new GspotError('template', [`The template at ${url} answered ${String(response.status)}.`]);
    return response.text();
}

function getLocalText(source: string, cwd: string): string {
    const path = resolve(cwd, source);
    try {
        return readFileSync(path, 'utf8');
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
            throw new GspotError('template', [`There is no template at ${source}.`]);
        throw error;
    }
}

/**
 * Export reusable policy while reporting every repository-specific entry left out.
 * @param policyText the text of gspot.toml
 * @param file the destination filename, which names the template
 * @returns the template text and omission report
 */
export function exportTemplate(policyText: string, file: string): ExportedTemplate {
    const raw = parseToml(policyText) as TomlTable;
    const leftOut: string[] = [];
    for (const table of REPOSITORY_TABLES) {
        const entries = raw[table];
        if (Array.isArray(entries))
            leftOut.push(...entries.map((_entry, index) => `${table}[${String(index)}]: belongs to this repository`));
        Reflect.deleteProperty(raw, table);
    }
    const targets = new Map<string, KeyPath>();
    for (const path of getRepositoryPaths(raw)) {
        // A path inside an array belongs to its entry; sibling entries retain their original policy.
        const entry = path.findLastIndex((key) => typeof key === 'number');
        const target = entry === -1 ? path : path.slice(0, entry + 1);
        targets.set(JSON.stringify(target), target);
    }
    const everyTarget = [...targets.values()];
    const paths = everyTarget.filter(
        (path) =>
            !everyTarget.some(
                (parent) => parent.length < path.length && parent.every((key, index) => key === path[index]),
            ),
    );
    leftOut.push(...paths.map((path) => `${locationText(path)}: names a repository path`));
    const omitted = new Set(paths.map((path) => JSON.stringify(path)));
    const { configurations, ...rest } = omitRepositoryPaths(raw, omitted) as TomlTable;
    const name = basename(file).replace(TEMPLATE_EXTENSION, '');
    const document = { template: name, selection: 'exact', configurations: configurations ?? [], ...rest };
    return { text: stringify(document).trimEnd().concat('\n'), leftOut };
}

/**
 * Validate a reusable template and retain its source and text digest.
 * @param text the TOML text
 * @param source the local path or address used in diagnostics
 * @returns the validated template
 * @throws GspotError('template') with every validation problem
 */
export function parseTemplate(text: string, source: string): Template {
    const raw = parseTomlText(text, source, 'template');
    const result = templateSchema.safeParse(raw);
    const shape = result.success
        ? []
        : result.error.issues.map((issue) => {
              const where = issue.path.map(String).join('.');
              return `${where === '' ? source : where}: ${issue.message}`;
          });
    const named = isRecord(raw) ? raw['configurations'] : undefined;
    const declarations = Array.isArray(named) ? named.map((name) => ({ name: String(name) })) : [];
    const unknown = unknownConfigurations(declarations, configurationManifests()).map(
        ({ message: diagnostic }) => diagnostic,
    );
    const paths = getRepositoryPaths(raw).map((path) => {
        const where = locationText(path.slice(0, -1));
        const key = path.at(-1);
        return `${where} holds \`${String(key)}\`, which names a path of one repository; a template carries no path.`;
    });
    const problems = [...shape, ...unknown, ...paths];
    if (!result.success || problems.length > 0) throw new GspotError('template', problems);
    return { source, digest: contentDigest(text), tables: result.data };
}

/**
 * Read a template from a local path, HTTPS address, or GitHub repository reference.
 * @param source a path, HTTPS address, or github:owner/repository[/path][@ref]
 * @param cwd the directory relative local paths start from
 * @returns the validated template
 */
export async function getTemplate(source: string, cwd: string): Promise<Template> {
    if (source.startsWith('http://')) throw new GspotError('template', ['A template is fetched over https, not http.']);
    const url = source.startsWith(GITHUB_PREFIX) ? buildGithubUrl(source) : source;
    const text = url.startsWith('https://') ? await getRemoteText(url) : getLocalText(source, cwd);
    return parseTemplate(text, source);
}
