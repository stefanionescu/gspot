import { stringify as stringifyYaml } from 'yaml';
import { PERIPHERY_RETAIN } from '#cli/config/generation/swift.ts';
import { stringify as stringifyToml } from '@decimalturn/toml-patch';
import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';
import type { ToolFileContext } from '#cli/types/generation/files.ts';

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
 * Build ansible lint file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the Ansible Lint exclusions as YAML.
 */
function buildAnsibleLintFile(context: ToolFileContext): string {
    const { rulesOff } = context.selection.view;

    return stringifyYaml({ skip_list: [...new Set([...ALWAYS_SKIPPED_TAGS, ...rulesOff('ansible/ansible-lint')])] });
}
/**
 * Build gixy file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the Gixy rule exclusions, or empty text when every rule stays enabled.
 */
function buildGixyFile(context: ToolFileContext): string {
    const { rulesOff } = context.selection.view;

    const off = rulesOff('nginx/gixy');
    return off.length === 0 ? '' : `skips = ${off.join(',')}\n`;
}
/**
 * Build lychee file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the Lychee link exclusions as TOML.
 */
function buildLycheeFile(context: ToolFileContext): string {
    const { options } = context.selection.view;

    const exclude = options('docs').allowed_urls;
    return stringifyToml(exclude.length === 0 ? {} : { exclude }, TOOL_EMIT_FORMAT).trimEnd();
}
/**
 * Build osv scanner file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the package ignores, reasons, and expiration dates for the scanner.
 */
function buildOsvScannerFile(context: ToolFileContext): string {
    const { ignoresFor } = context.selection.view;

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
 * Build periphery file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the Xcode project, schemes, and retained Periphery declarations as YAML.
 */
function buildPeripheryFile(context: ToolFileContext): string {
    const { settings } = context.selection.view;

    const project = settings['xcode.project'];
    const scheme = settings['xcode.scheme'];
    return stringifyYaml({
        ...(project === undefined ? {} : { project }),
        ...(scheme === undefined ? {} : { schemes: [scheme] }),
        ...PERIPHERY_RETAIN,
    });
}
/**
 * Build purgecss file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
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
 * Build spectral file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the OpenAPI preset and the Spectral rules selected at this level.
 */
function buildSpectralFile(context: ToolFileContext): string {
    const isAll = context.level === 'all';

    return stringifyYaml({
        extends: ['spectral:oas'],
        ...(isAll ? {} : { rules: Object.fromEntries(SPECTRAL_RECOMMENDED_OFF.map((name) => [name, 'off'])) }),
    }).trimEnd();
}
/**
 * Build taplo file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
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
        TOOL_EMIT_FORMAT,
    ).trimEnd();
}
/**
 * Build trivy file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
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
 * Build v8r file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
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
