import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { isRecord } from '#cli/objects.ts';
import { GspotError } from '#cli/errors.ts';
import { contentDigest } from '#cli/text.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { templateSchema } from '#cli/settings/schema/templates.ts';
import { emitSettings, parseTomlText } from '#cli/settings/file.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { unknownConfigurations } from '#cli/configurations/unknown-names.ts';
import type { Template, ExportedTemplate } from '#cli/types/settings/file.ts';
import { environmentVariable, environmentVariables } from '#cli/system/environment.ts';

import {
    RAW_HOST,
    HTTP_PREFIX,
    HTTPS_PREFIX,
    GITHUB_PREFIX,
    TEMPLATE_FILE,
    DEFAULT_GIT_REF,
    REQUEST_TIMEOUT_MS,
    GITHUB_TOKEN_VARIABLE,
} from '#cli/config/settings/templates.ts';

function githubRawUrl(source: string): string {
    const [location = '', ref = DEFAULT_GIT_REF] = source.slice(GITHUB_PREFIX.length).split('@');
    const [owner = '', repository = '', ...rest] = location.split('/');
    const file = rest.length === 0 ? TEMPLATE_FILE : rest.join('/');
    return `${RAW_HOST}/${owner}/${repository}/${ref}/${file}`;
}

async function downloadText(url: string): Promise<string> {
    const token =
        new URL(url).origin === new URL(RAW_HOST).origin
            ? environmentVariable(environmentVariables(), GITHUB_TOKEN_VARIABLE)
            : undefined;
    const headers = token === undefined ? {} : { Authorization: `Bearer ${token}` };
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers });
    if (!response.ok) throw new GspotError('template', [`The template at ${url} answered ${String(response.status)}.`]);
    return response.text();
}

function readLocalText(source: string, cwd: string): string {
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
 * Export reusable settings while reporting every repository-specific entry left out.
 * @param settingsText the text of gspot.toml
 * @returns the template text and omission report
 */
export function exportTemplate(settingsText: string): ExportedTemplate {
    const written = parseTomlText(settingsText, SETTINGS_FILE, 'settings');
    const scopes = Array.isArray(written['scope'])
        ? written['scope'].flatMap((scope) =>
              isRecord(scope) && typeof scope['path'] === 'string' ? [scope['path']] : [],
          )
        : [];
    Reflect.deleteProperty(written, 'scope');
    const document = written;
    return {
        text: emitSettings(settingsText, document),
        leftOut: scopes.map((scope) => `scope.${JSON.stringify(scope)}: belongs to this repository`),
    };
}

/**
 * Validate a reusable template and retain its source and text digest.
 * @param text the TOML text
 * @param source the local path or address used in diagnostics
 * @returns the validated template
 * @throws GspotError with every template validation error.
 */
export function parseTemplate(text: string, source: string): Template {
    const written = parseTomlText(text, source, 'template');
    const result = templateSchema.safeParse(written);
    const shape = result.success
        ? []
        : result.error.issues.map((issue) => {
              const where = issue.path.map(String).join('.');
              return `${where === '' ? source : where}: ${issue.message}`;
          });
    const named = written['configurations'];
    const declarations = Array.isArray(named) ? named.map((name) => ({ name: String(name) })) : [];
    const unknown = unknownConfigurations(declarations, configurationManifests()).map(
        ({ message: diagnostic }) => diagnostic,
    );
    const errors = [...shape, ...unknown];
    if (!result.success || errors.length > 0) throw new GspotError('template', errors);
    return {
        text,
        digest: contentDigest(text),
        source,
        tables: written,
    };
}

/**
 * Read a template from a local path, HTTPS address, or GitHub repository reference.
 * @param source a path, HTTPS address, or github:owner/repository[/path][@ref]
 * @param cwd the directory relative local paths start from
 * @returns the validated template
 */
export async function downloadTemplate(source: string, cwd: string): Promise<Template> {
    if (source.startsWith(HTTP_PREFIX))
        throw new GspotError('template', ['A template is downloaded over https, not http.']);
    const url = source.startsWith(GITHUB_PREFIX) ? githubRawUrl(source) : source;
    const text = url.startsWith(HTTPS_PREFIX) ? await downloadText(url) : readLocalText(source, cwd);
    return parseTemplate(text, source);
}
