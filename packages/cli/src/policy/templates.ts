// Reusable policy: source acquisition, validation, and export share one repository-path calculation.
import { readFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { isRecord } from '#cli/platform/objects.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { contentDigest } from '#cli/platform/text.ts';
import { emitPolicy, parseTomlText } from '#cli/policy/file.ts';
import { templateSchema } from '#cli/policy/schema/templates.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { unknownConfigurations } from '#cli/configurations/problems.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import type { Template, ExportedTemplate } from '#cli/types/policy/templates.ts';

import {
    RAW_HOST,
    GITHUB_PREFIX,
    TEMPLATE_FILE,
    REQUEST_TIMEOUT_MS,
    TEMPLATE_EXTENSION,
} from '#cli/config/policy/templates.ts';

function buildGithubUrl(source: string): string {
    const [location = '', ref = 'HEAD'] = source.slice(GITHUB_PREFIX.length).split('@');
    const [owner = '', repository = '', ...rest] = location.split('/');
    const file = rest.length === 0 ? TEMPLATE_FILE : rest.join('/');
    return `${RAW_HOST}/${owner}/${repository}/${ref}/${file}`;
}

async function getRemoteText(url: string): Promise<string> {
    const token = new URL(url).origin === new URL(RAW_HOST).origin ? environmentVariables()['GITHUB_TOKEN'] : undefined;
    const headers = token === undefined ? {} : { Authorization: `Bearer ${token}` };
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers });
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
    const raw = parseTomlText(policyText, 'gspot.toml', 'policy');
    const scopes = isRecord(raw['scope']) ? Object.keys(raw['scope']) : [];
    Reflect.deleteProperty(raw, 'scope');
    const name = basename(file).replace(TEMPLATE_EXTENSION, '');
    const document = { template: name, selection: 'exact', ...raw };
    return {
        text: emitPolicy(policyText, document),
        leftOut: scopes.map((scope) => `scope.${JSON.stringify(scope)}: belongs to this repository`),
    };
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
    const problems = [...shape, ...unknown];
    if (!result.success || problems.length > 0) throw new GspotError('template', problems);
    return {
        text,
        digest: contentDigest(text),
        tables: {
            ...result.data,
            template: result.data.template ?? basename(source).replace(TEMPLATE_EXTENSION, ''),
            selection: result.data.selection ?? 'exact',
        },
    };
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
