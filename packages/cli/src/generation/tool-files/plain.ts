import { stringify as stringifyYaml } from 'yaml';
import { type ScopeView } from '#cli/types/settings/values.ts';
import { PERIPHERY_RETAIN } from '#cli/config/generation/swift.ts';
import { stringify as stringifyToml } from '@decimalturn/toml-patch';
import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';

import {
    MISE_SCHEMA,
    TOOL_EMIT_FORMAT,
    TAPLO_FORMATTING,
    PURGECSS_EXTRACTOR,
    PURGECSS_TOKEN_END,
    ALWAYS_SKIPPED_TAGS,
    TRIVY_SKIPPED_FOLDERS,
    SPECTRAL_RECOMMENDED_OFF,
    PURGECSS_PSEUDO_CLASS_PATTERN,
} from '#cli/config/generation/tool-file-sources.ts';

/**
 * Keep disabled Ansible rules in the scope's configuration.
 *
 * @param root0 the values for this generated file.
 * @param root0.rulesOff the disabled lint rule reader.
 *
 * @returns the generated configuration text.
 */
export function buildAnsibleLintFile({ rulesOff }: Pick<ScopeView, 'rulesOff'>): string {
    return stringifyYaml({ skip_list: [...new Set([...ALWAYS_SKIPPED_TAGS, ...rulesOff('ansible/ansible-lint')])] });
}

/**
 * Write the gixy configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.rulesOff the disabled lint rule reader.
 *
 * @returns the generated configuration text.
 */
export function buildGixyFile({ rulesOff }: Pick<ScopeView, 'rulesOff'>): string {
    const off = rulesOff('nginx/gixy');
    return off.length === 0 ? '' : `skips = ${off.join(',')}\n`;
}

/**
 * Write the lychee configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.options the command options.
 *
 * @returns the generated configuration text.
 */
export function buildLycheeFile({ options }: Pick<ScopeView, 'options'>): string {
    const exclude = options('docs').allowed_urls;
    return stringifyToml(exclude.length === 0 ? {} : { exclude }, TOOL_EMIT_FORMAT).trimEnd();
}

/**
 * Write the osvScanner configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.ignoresFor the check path-ignore reader.
 *
 * @returns the generated configuration text.
 */
export function buildOsvScannerFile({ ignoresFor }: Pick<ScopeView, 'ignoresFor'>): string {
    const entries = ignoresFor('dependencies/osv').filter(
        (entry) => entry.rule !== undefined && entry.paths.length === 0,
    );
    return stringifyToml(
        entries.length === 0
            ? {}
            : {
                  IgnoredVulns: entries.map((entry) => ({
                      id: entry.rule,
                      ...(entry.until ? { ignoreUntil: entry.until } : {}),
                      reason: entry.reason,
                  })),
              },
        TOOL_EMIT_FORMAT,
    ).trimEnd();
}

/**
 * Write the periphery configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.settings the validated settings.
 *
 * @returns the generated configuration text.
 */
export function buildPeripheryFile({ settings }: Pick<ScopeView, 'settings'>): string {
    const project = settings['xcode.project'];
    const scheme = settings['xcode.scheme'];
    return stringifyYaml({
        ...(project === undefined ? {} : { project }),
        ...(scheme === undefined ? {} : { schemes: [scheme] }),
        ...PERIPHERY_RETAIN,
    });
}

/**
 * Write the purgecss configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.options the command options.
 *
 * @returns the generated configuration text.
 */
export function buildPurgecssFile({ options }: Pick<ScopeView, 'options'>): string {
    const standard = [
        String(PURGECSS_PSEUDO_CLASS_PATTERN),
        ...options('tools.purgecss').safelist.map((word) => JSON.stringify(word, null, JSON_INDENT)),
    ];
    return `export const defaultExtractor = (content) => (content.match(${String(PURGECSS_EXTRACTOR)}) ?? []).map((token) => { let end = token.length; while (end > 0 && token[end - 1] === ${JSON.stringify(PURGECSS_TOKEN_END)}) end--; return token.slice(0, end); }).filter((token) => token !== '');\nexport const safelist = { standard: [${standard.join(', ')}] };\n`;
}

/**
 * Write the spectral configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.isAll whether the all level applies.
 *
 * @returns the generated configuration text.
 */
export function buildSpectralFile({ isAll }: { isAll: boolean }): string {
    return stringifyYaml({
        extends: ['spectral:oas'],
        ...(isAll ? {} : { rules: Object.fromEntries(SPECTRAL_RECOMMENDED_OFF.map((name) => [name, 'off'])) }),
    }).trimEnd();
}

/**
 * Write the taplo configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.format the resolved formatting settings.
 * @param root0.extra the authored additional tool options.
 *
 * @returns the generated configuration text.
 */
export function buildTaploFile({ format, extra }: Pick<ScopeView, 'format' | 'extra'>): string {
    return stringifyToml(
        {
            schema: { enabled: false },
            formatting: {
                indent_string: format.indent_style === 'tab' ? '\t' : ' '.repeat(format.indent_width),
                column_width: format.print_width,
                ...TAPLO_FORMATTING,
                ...extra('taplo'),
            },
        },
        TOOL_EMIT_FORMAT,
    ).trimEnd();
}

/**
 * Write the trivy configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.settings the validated settings.
 *
 * @returns the generated configuration text.
 */
export function buildTrivyFile({ settings }: Pick<ScopeView, 'settings'>): string {
    return stringifyYaml({
        timeout: `${String(settings['tool_timeout_seconds'])}s`,
        severity: settings['tools.trivy.severity'],
        scan: { 'skip-dirs': TRIVY_SKIPPED_FOLDERS },
    }).trimEnd();
}

/**
 * Write the v8r configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.settings the validated settings.
 *
 * @returns the generated configuration text.
 */
export function buildV8rFile({ settings }: Pick<ScopeView, 'settings'>): string {
    const schemas = (settings['tools.v8r.schema'] as { paths: string[]; url: string }[]).map(({ paths, url }) => ({
        name: url,
        fileMatch: paths,
        location: url,
    }));
    return (
        '# Files without a known schema are checked by their other selected tools.\n' +
        stringifyYaml({ ignoreErrors: true, customCatalog: { schemas: [MISE_SCHEMA, ...schemas] } }).trimEnd()
    );
}
