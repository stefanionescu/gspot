import { stringify as stringifyYaml } from 'yaml';
import { SITE_CONFIGURATION } from '#cli/config/configurations.ts';
import { PERIPHERY_RETAIN } from '#cli/config/generation/swift.ts';
import { stringify as stringifyToml } from '@decimalturn/toml-patch';
import type { ToolFileContext } from '#cli/types/generation/files.ts';
import { getTable, listIgnores, listIgnoredRules } from '#cli/settings/scope-view.ts';

import {
    MISE_SCHEMA,
    TOML_FORMAT,
    TOOL_FILE_NOTES,
    TAPLO_FORMATTING,
    LYCHEE_ROOT_LINKS,
    PURGECSS_EXTRACTOR,
    PURGECSS_TOKEN_END,
    ALWAYS_SKIPPED_TAGS,
    LYCHEE_MDX_EXPRESSION,
    TRIVY_SKIPPED_FOLDERS,
    LYCHEE_REPOSITORY_LINKS,
    SPECTRAL_RECOMMENDED_OFF,
    PURGECSS_PSEUDO_CLASS_PATTERN,
} from '#cli/config/generation/settings.ts';

/**
 * Build the Ansible Lint file from the settings.
 *
 * @param context the tool file to build.
 * @returns the Ansible Lint exclusions as YAML.
 */
function buildAnsibleLintFile(context: ToolFileContext): string {
    return stringifyYaml({
        skip_list: [
            ...new Set([...ALWAYS_SKIPPED_TAGS, ...listIgnoredRules(context.selection, 'ansible/ansible-lint')]),
        ],
    });
}
/**
 * Build the Gixy file from the settings.
 *
 * @param context the tool file to build.
 * @returns the Gixy rule exclusions, or empty text when every rule stays enabled.
 */
function buildGixyFile(context: ToolFileContext): string {
    const off = listIgnoredRules(context.selection, 'nginx/gixy');
    return off.length === 0 ? '' : `skips = ${off.join(',')}`;
}
/**
 * Build the Lychee file from the settings.
 *
 * @param context the tool file to build.
 * @returns a note on why the file exists, and the lychee link exclusions as TOML.
 */
function buildLycheeFile(context: ToolFileContext): string {
    const { selected, view } = context.selection;

    const exclude = [...getTable(view, 'docs').allowed_urls, LYCHEE_MDX_EXPRESSION];
    // site/lychee checks the routes in the built site, so lychee skips them.
    const document = selected.some(({ configuration }) => configuration.name === SITE_CONFIGURATION)
        ? { exclude: [...exclude, LYCHEE_ROOT_LINKS] }
        : { exclude, remap: [`${LYCHEE_ROOT_LINKS} ${LYCHEE_REPOSITORY_LINKS}`] };
    return [...TOOL_FILE_NOTES.lychee, stringifyToml(document, TOML_FORMAT)].join('\n');
}
/**
 * Build the `osv-scanner` tool file from the settings.
 *
 * @param context the tool file to build.
 * @returns a note on why the file exists, and the package ignores, reasons, and expiration dates.
 */
function buildOsvScannerFile(context: ToolFileContext): string {
    const entries = listIgnores(context.selection.view, 'dependencies/osv-scanner').filter(
        (entry) => entry.rule !== undefined && entry.paths.length === 0,
    );
    const vulnerabilities = entries.map((entry) => ({
        id: entry.rule,
        ...(entry.until ? { ignoreUntil: entry.until } : {}),
        reason: entry.reason,
    }));
    return [
        ...TOOL_FILE_NOTES.osvScanner,
        stringifyToml(entries.length === 0 ? {} : { IgnoredVulns: vulnerabilities }, TOML_FORMAT),
    ].join('\n');
}
/**
 * Build the Periphery file from the settings.
 *
 * @param context the tool file to build.
 * @returns the Xcode project, schemes, and retained Periphery declarations as YAML.
 */
function buildPeripheryFile(context: ToolFileContext): string {
    const project = getTable(context.selection.view, 'swift').xcode_project;
    const scheme = getTable(context.selection.view, 'swift').xcode_scheme;
    return stringifyYaml({
        ...(project === undefined ? {} : { project }),
        ...(scheme === undefined ? {} : { schemes: [scheme] }),
        ...PERIPHERY_RETAIN,
    });
}
/**
 * Build the PurgeCSS file from the settings.
 *
 * @param context the tool file to build.
 * @returns the JavaScript token extractor and safelist used by PurgeCSS.
 */
function buildPurgecssFile(context: ToolFileContext): string {
    const standard = [
        String(PURGECSS_PSEUDO_CLASS_PATTERN),
        ...getTable(context.selection.view, 'tools.purgecss').safelist.map((word) => JSON.stringify(word)),
    ];
    return `export const defaultExtractor = (content) =>
    (content.match(${String(PURGECSS_EXTRACTOR)}) ?? [])
        .map((token) => {
            let end = token.length;
            while (end > 0 && token[end - 1] === ${JSON.stringify(PURGECSS_TOKEN_END)}) end--;
            return token.slice(0, end);
        })
        .filter((token) => token !== '');

export const safelist = {
    standard: [
        ${standard.join(',\n        ')},
    ],
};`;
}
/**
 * Build the Spectral file from the settings.
 *
 * @param context the tool file to build.
 * @returns the OpenAPI preset and the Spectral rules at this level.
 */
function buildSpectralFile(context: ToolFileContext): string {
    const isAll = context.level === 'all';

    return stringifyYaml({
        extends: ['spectral:oas'],
        ...(isAll ? {} : { rules: Object.fromEntries(SPECTRAL_RECOMMENDED_OFF.map((name) => [name, 'off'])) }),
    });
}
/**
 * Build the Taplo file from the settings.
 *
 * @param context the tool file to build.
 * @returns the Taplo formatting settings with automatic schema lookup disabled.
 */
function buildTaploFile(context: ToolFileContext): string {
    const { format } = context.selection.view.values;

    return stringifyToml(
        {
            schema: { enabled: false },
            formatting: {
                indent_string: format.indent_style === 'tab' ? '\t' : ' '.repeat(format.indent_width),
                column_width: format.print_width,
                ...TAPLO_FORMATTING,
            },
        },
        TOML_FORMAT,
    );
}
/**
 * Build the Trivy file from the settings.
 *
 * @param context the tool file to build.
 * @returns the Trivy severity, timeout, and skipped folders as YAML.
 */
function buildTrivyFile(context: ToolFileContext): string {
    return stringifyYaml({
        timeout: `${String(context.session.settingsFile.settings.tool_timeout_seconds)}s`,
        severity: getTable(context.selection.view, 'tools.trivy').severity,
        scan: { 'skip-dirs': TRIVY_SKIPPED_FOLDERS },
    });
}
/**
 * Build the v8r file from the settings.
 *
 * @param context the tool file to build.
 * @returns the v8r schema catalog, including the configured file selectors.
 */
function buildV8rFile(context: ToolFileContext): string {
    const schemas = getTable(context.selection.view, 'tools.v8r').schema.map(({ paths, url }) => ({
        name: url,
        fileMatch: paths,
        location: url,
    }));
    return (
        '# Files without a known schema are checked by their other selected tools.\n' +
        stringifyYaml({
            ignoreErrors: true,
            customCatalog: { schemas: [MISE_SCHEMA, ...schemas] },
        })
    );
}

export {
    buildV8rFile,
    buildGixyFile,
    buildTaploFile,
    buildTrivyFile,
    buildLycheeFile,
    buildPurgecssFile,
    buildSpectralFile,
    buildPeripheryFile,
    buildOsvScannerFile,
    buildAnsibleLintFile,
};
