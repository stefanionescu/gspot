import { stringify as stringifyYaml } from 'yaml';
import { PERIPHERY_RETAIN } from '#cli/config/generation/swift.ts';
import { stringify as stringifyToml } from '@decimalturn/toml-patch';
import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';
import type { ToolFileContext } from '#cli/types/generation/files.ts';

import {
    MISE_SCHEMA,
    TOML_FORMAT,
    TOOL_FILE_NOTES,
    TAPLO_FORMATTING,
    PURGECSS_EXTRACTOR,
    PURGECSS_TOKEN_END,
    ALWAYS_SKIPPED_TAGS,
    TRIVY_SKIPPED_FOLDERS,
    SPECTRAL_RECOMMENDED_OFF,
    PURGECSS_PSEUDO_CLASS_PATTERN,
} from '#cli/config/generation/tool-files.ts';

/**
 * Build the Ansible Lint file from the settings.
 * @param context the tool file to build.
 * @returns the Ansible Lint exclusions as YAML.
 */
function buildAnsibleLintFile(context: ToolFileContext): string {
    const { rulesOff } = context.selection.view;

    return stringifyYaml({ skip_list: [...new Set([...ALWAYS_SKIPPED_TAGS, ...rulesOff('ansible/ansible-lint')])] });
}
/**
 * Build the Gixy file from the settings.
 * @param context the tool file to build.
 * @returns the Gixy rule exclusions, or empty text when every rule stays enabled.
 */
function buildGixyFile(context: ToolFileContext): string {
    const { rulesOff } = context.selection.view;

    const off = rulesOff('nginx/gixy');
    return off.length === 0 ? '' : `skips = ${off.join(',')}\n`;
}
/**
 * Build the Lychee file from the settings.
 * @param context the tool file to build.
 * @returns a note on why the file exists, and the lychee link exclusions as TOML.
 */
function buildLycheeFile(context: ToolFileContext): string {
    const { options } = context.selection.view;

    const exclude = options('docs').allowed_urls;
    return [...TOOL_FILE_NOTES.lychee, stringifyToml(exclude.length === 0 ? {} : { exclude }, TOML_FORMAT)].join('\n');
}
/**
 * Build the `osv-scanner` tool file from the settings.
 * @param context the tool file to build.
 * @returns a note on why the file exists, and the package ignores, reasons, and expiration dates.
 */
function buildOsvScannerFile(context: ToolFileContext): string {
    const { ignoresFor } = context.selection.view;

    const entries = ignoresFor('dependencies/osv-scanner').filter(
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
 * @param context the tool file to build.
 * @returns the Xcode project, schemes, and retained Periphery declarations as YAML.
 */
function buildPeripheryFile(context: ToolFileContext): string {
    const { settings } = context.selection.view;

    const project = settings['swift.xcode_project'];
    const scheme = settings['swift.xcode_scheme'];
    return stringifyYaml({
        ...(project === undefined ? {} : { project }),
        ...(scheme === undefined ? {} : { schemes: [scheme] }),
        ...PERIPHERY_RETAIN,
    });
}
/**
 * Build the PurgeCSS file from the settings.
 * @param context the tool file to build.
 * @returns the JavaScript token extractor and safelist used by PurgeCSS.
 */
function buildPurgecssFile(context: ToolFileContext): string {
    const { options } = context.selection.view;

    const standard = [
        String(PURGECSS_PSEUDO_CLASS_PATTERN),
        ...options('tools.purgecss').safelist.map((word) => JSON.stringify(word, null, JSON_INDENT)),
    ];
    return `export const defaultExtractor = (content) => (content.match(${String(PURGECSS_EXTRACTOR)}) ?? []).map((token) => { let end = token.length; while (end > 0 && token[end - 1] === ${JSON.stringify(PURGECSS_TOKEN_END)}) end--; return token.slice(0, end); }).filter((token) => token !== '');\nexport const safelist = { standard: [${standard.join(', ')}] };\n`;
}
/**
 * Build the Spectral file from the settings.
 * @param context the tool file to build.
 * @returns the OpenAPI preset and the Spectral rules at this level.
 */
function buildSpectralFile(context: ToolFileContext): string {
    const isAll = context.level === 'all';

    return stringifyYaml({
        extends: ['spectral:oas'],
        ...(isAll ? {} : { rules: Object.fromEntries(SPECTRAL_RECOMMENDED_OFF.map((name) => [name, 'off'])) }),
    }).trimEnd();
}
/**
 * Build the Taplo file from the settings.
 * @param context the tool file to build.
 * @returns the Taplo formatting settings with automatic schema lookup disabled.
 */
function buildTaploFile(context: ToolFileContext): string {
    const { format, extra } = context.selection.view;

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
        TOML_FORMAT,
    ).trimEnd();
}
/**
 * Build the Trivy file from the settings.
 * @param context the tool file to build.
 * @returns the Trivy severity, timeout, and skipped folders as YAML.
 */
function buildTrivyFile(context: ToolFileContext): string {
    const { settings } = context.selection.view;

    return stringifyYaml({
        timeout: `${String(settings['tool_timeout_seconds'])}s`,
        severity: settings['tools.trivy.severity'],
        scan: { 'skip-dirs': TRIVY_SKIPPED_FOLDERS },
    }).trimEnd();
}
/**
 * Build the v8r file from the settings.
 * @param context the tool file to build.
 * @returns the v8r schema catalog, including the configured file selectors.
 */
function buildV8rFile(context: ToolFileContext): string {
    const { settings } = context.selection.view;

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
