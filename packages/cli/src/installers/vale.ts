import { createHash } from 'node:crypto';
import { JSON_INDENT } from '#cli/config/text.ts';
import { getTool } from '#cli/manifests/tools.ts';
import { CONFIG_FLAG } from '#cli/config/flags.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { Level } from '#cli/types/manifests.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { join, posix, dirname, resolve } from 'node:path';
import type { Settings } from '#cli/types/settings/file.ts';
import { downloadArchive } from '#cli/installers/downloads.ts';
import { VALE_TOOL, PROSE_GRAMMARS } from '#cli/config/prose.ts';
import { runRequiredInstallStep } from '#cli/installers/steps.ts';
import type { ToolInstall } from '#cli/types/installers/install.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { inspectTool, buildToolAvailability } from '#cli/tools/inspect.ts';
import { rmSync, mkdirSync, renameSync, mkdtempSync, writeFileSync } from 'node:fs';
import { VALE_STYLES_PATH } from '#cli/config/generation/configurations/general/prose.ts';

import {
    VOCAB_LINE,
    ALT_TEXT_ON,
    ALT_TEXT_OFF,
    VALE_PACKAGES,
    BLOCK_IGNORES,
    TOKEN_IGNORES,
    MIN_ALERT_LINE,
    NO_STYLES_LINE,
    VALE_OFF_RULES,
    VALE_PACKAGE_URLS,
    VALE_INSTALL_STEP,
    ALL_FILES_SECTION,
    VALE_MARKUP_RULES,
    VALE_MARKUP_FILES,
    VALE_DOWNLOAD_NAME,
    VALE_ARCHIVE_LIMIT,
    VALE_COMMENT_RULES,
    STYLES_PATH_COMMENT,
    VALE_INSTALL_PREFIX,
    VALE_SKIPPED_SCOPES,
    MARKUP_RULES_COMMENT,
    VALE_PACKAGE_FOLDERS,
    VALE_PACKAGE_RELEASES,
    VALE_INSTALL_ARGUMENTS,
} from '#cli/config/installers/vale.ts';

async function downloadValePackages(install: ToolInstall, folder: string): Promise<string[]> {
    const packages: string[] = [];
    for (const name of VALE_PACKAGES) {
        const release = VALE_PACKAGE_RELEASES[name];
        const url = VALE_PACKAGE_URLS[name];
        const bytes = await downloadArchive(install, { url, name: VALE_DOWNLOAD_NAME, limit: VALE_ARCHIVE_LIMIT });
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        if (sha256 !== release.sha256)
            throw new GspotError(
                'install',
                `The Vale package ${name} failed SHA-256 verification. gspot kept the installed packages.`,
            );
        const path = join(folder, `${name}.zip`);
        writeFileSync(path, bytes);
        packages.push(convertToPosixPath(path));
    }
    return packages;
}

/**
Check that the Vale packages exist before prose checks run.

@param root the root with the generated Vale files and package folders.
@param level the configured level, which decides the packages.
*/
export function hasValePackages(root: string, level: Settings['level']): boolean {
    const files = openFiles(root);
    if (files.read(GSPOT_PATHS.valeConfigFile) === undefined) return false;
    if (level === 'basic') return true;
    return VALE_PACKAGE_FOLDERS.every(
        (name) => files.readStats(`${GSPOT_PATHS.valePackages}/${name}`)?.isDirectory() === true,
    );
}

/**
Download the Vale packages for the level, and replace the installed ones, when a selected configuration uses Vale.
Skip the download when every package folder exists and the release file names the pinned releases. Needs the network.

@param install what install needs for this step.
@param miseBinPaths the program folders that mise installed, where Vale may sit.
*/
export async function installValePackages(install: ToolInstall, miseBinPaths: string[]): Promise<string> {
    const { session } = install;
    const { root } = session;
    const level = session.settings.level;
    const usesVale = session.toolConfigurations.some(({ tools }) => tools.some((tool) => tool.name === VALE_TOOL));
    if (level === 'basic' || !usesVale) return '';
    const files = openFiles(root);
    const releases = `${JSON.stringify(VALE_PACKAGE_RELEASES, null, JSON_INDENT)}\n`;
    if (files.read(GSPOT_PATHS.valeReleases)?.bytes.toString('utf8') === releases && hasValePackages(root, level))
        return '';
    const tool = getTool(session.toolConfigurations, VALE_TOOL);
    const available = buildToolAvailability(tool, inspectTool({ ...session, miseBinPaths }, tool));
    if ('status' in available) throw new GspotError('tool', available.note);
    const temporary = mkdtempSync(join(files.readCanonicalPath(GSPOT_FOLDER), VALE_INSTALL_PREFIX));
    try {
        const config = join(temporary, GSPOT_PATHS.valeConfigFile);
        const content = buildValeIni({
            level,
            stylesPaths: [
                convertToPosixPath(resolve(root, VALE_STYLES_PATH)),
                posix.relative(posix.dirname(GSPOT_PATHS.valeConfigFile), GSPOT_PATHS.valePackages),
            ],
            packages: await downloadValePackages(install, temporary),
        });
        mkdirSync(dirname(config), { recursive: true });
        writeFileSync(config, content);
        const command = [available.path, CONFIG_FLAG, config, ...VALE_INSTALL_ARGUMENTS];
        await runRequiredInstallStep(install, command, { cwd: dirname(config), name: VALE_INSTALL_STEP });
        writeFileSync(join(temporary, GSPOT_PATHS.valeReleases), releases);
        files.deleteTree(GSPOT_PATHS.valePackages);
        renameSync(join(temporary, GSPOT_PATHS.valePackages), join(root, GSPOT_PATHS.valePackages));
        return `installed Vale packages in ${GSPOT_PATHS.valePackages}`;
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
}

/**
Build the text of a vale.ini from its style folders and package sources.

@param ini the vale.ini settings.
@param ini.level the configured level; level all adds the packages and the rules for code.
@param ini.stylesPaths the style folders; Vale installs packages in the last one.
@param ini.packages the package archives: each a URL or a local path.
*/
export function buildValeIni({
    level,
    stylesPaths,
    packages,
}: {
    level: Level;
    stylesPaths: string[];
    packages: string[];
}): string {
    const isAll = level === 'all';
    const markupRules = isAll ? VALE_MARKUP_RULES : [];
    const formats = Object.entries(PROSE_GRAMMARS).flatMap(([extension, grammar]) =>
        'format' in grammar ? [[extension.slice(1), grammar.format] as const] : [],
    );
    const lines = [
        ...(isAll ? [STYLES_PATH_COMMENT] : []),
        ...stylesPaths.map((path) => `StylesPath = ${path}`),
        MIN_ALERT_LINE,
        `SkippedScopes = ${VALE_SKIPPED_SCOPES}`,
        ...(isAll ? [`Packages = ${packages.join(', ')}`, VOCAB_LINE] : []),
        '',
        ...(isAll ? ['[formats]', ...formats.map(([extension, format]) => `${extension} = ${format}`)] : []),
        '',
        ALL_FILES_SECTION,
        `BasedOnStyles = ${(isAll ? ['gspot', 'Vale', ...VALE_PACKAGES] : ['gspot']).join(', ')}`,
        `BlockIgnores = ${BLOCK_IGNORES.join(', ')}`,
        `TokenIgnores = ${TOKEN_IGNORES.join(', ')}`,
        ...(isAll ? Object.entries(VALE_OFF_RULES).flatMap(([rule, reason]) => [`# ${reason}`, `${rule} = NO`]) : []),
        MARKUP_RULES_COMMENT,
        ALT_TEXT_OFF,
        ...markupRules.map((rule) => `${rule} = NO`),
        '',
        ...(isAll
            ? [
                  `[*.{${formats.map(([extension]) => extension).join(',')}}]`,
                  NO_STYLES_LINE,
                  ...VALE_COMMENT_RULES.map((rule) => `${rule} = YES`),
              ]
            : []),
        '',
        `[${VALE_MARKUP_FILES}]`,
        ALT_TEXT_ON,
        ...markupRules.map((rule) => `${rule} = YES`),
    ];
    return lines.join('\n');
}
