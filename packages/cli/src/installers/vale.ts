import { createHash } from 'node:crypto';
import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { Level } from '#cli/types/configurations.ts';
import { join, posix, dirname, resolve } from 'node:path';
import type { Settings } from '#cli/types/settings/file.ts';
import { downloadArchive } from '#cli/installers/downloads.ts';
import { VALE_TOOL, PROSE_GRAMMARS } from '#cli/config/prose.ts';
import { runRequiredInstallStep } from '#cli/installers/steps.ts';
import type { ToolInstall } from '#cli/types/installers/install.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { inspectTool, buildToolAvailability } from '#cli/tools/inspect.ts';
import { buildInstallKey, recordInstalledProject } from '#cli/installers/record.ts';
import { rmSync, mkdirSync, renameSync, mkdtempSync, writeFileSync } from 'node:fs';

import {
    VALE_PACKAGES,
    VALE_STYLES_PATH,
    VALE_PACKAGE_RELEASES,
    VALE_PACKAGE_REPOSITORY,
} from '#cli/config/generation/configurations/general/prose.ts';
import {
    BLOCK_IGNORES,
    TOKEN_IGNORES,
    VALE_OFF_RULES,
    VALE_MARKUP_RULES,
    VALE_MARKUP_FILES,
    VALE_ARCHIVE_LIMIT,
    VALE_COMMENT_RULES,
    VALE_INSTALL_PREFIX,
    VALE_SKIPPED_SCOPES,
    VALE_PACKAGE_FOLDERS,
    VALE_INSTALL_ARGUMENTS,
} from '#cli/config/installers/vale.ts';

async function downloadValePackages(install: ToolInstall, folder: string): Promise<string[]> {
    const packages: string[] = [];
    for (const name of VALE_PACKAGES) {
        const release = VALE_PACKAGE_RELEASES[name];
        const url = `${VALE_PACKAGE_REPOSITORY}${name}/releases/download/${release.version}/${name}.zip`;
        const bytes = await downloadArchive(install, { url, name: 'the Vale package', limit: VALE_ARCHIVE_LIMIT });
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
@param level recommended or all, which decides the packages.
@returns whether the Vale settings and the package folders exist.
*/
export function hasValePackages(root: string, level: Settings['level']): boolean {
    using files = openFiles(root);
    if (files.read(GSPOT_PATHS.valeConfigFile) === undefined) return false;
    if (level === 'recommended') return true;
    return VALE_PACKAGE_FOLDERS.every(
        (name) => files.readStats(`${GSPOT_PATHS.valePackages}/${name}`)?.isDirectory() === true,
    );
}

/**
Download the Vale packages for the level, and replace the installed ones, when a selected configuration uses Vale.
Needs the network.

@param install what install needs for this step.
@param miseBinPaths the program folders that mise installed, where Vale may sit.
@returns the install summary.
*/
export async function installValePackages(install: ToolInstall, miseBinPaths: string[]): Promise<string> {
    const { session } = install;
    const { root } = session;
    const level = session.settings.level;
    const usesVale = session.toolConfigurations.some(({ tools }) => tools.some((tool) => tool.name === VALE_TOOL));
    if (level === 'recommended' || !usesVale) return '';
    const key = buildInstallKey([level, JSON.stringify(VALE_PACKAGE_RELEASES)]);
    if (install.record.vale === key && install.writer.readStats(GSPOT_PATHS.valePackages)?.isDirectory() === true)
        return '';
    const tool = getTool(session.toolConfigurations, VALE_TOOL);
    const available = buildToolAvailability(tool, inspectTool({ ...session, miseBinPaths }, tool));
    if ('status' in available) throw new GspotError('tool', available.note);
    using files = openFiles(root);
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
        const command = [available.path, '--config', config, ...VALE_INSTALL_ARGUMENTS];
        await runRequiredInstallStep(install, command, { cwd: dirname(config), name: 'Vale sync' });
        files.deleteTree(GSPOT_PATHS.valePackages);
        renameSync(join(temporary, GSPOT_PATHS.valePackages), join(root, GSPOT_PATHS.valePackages));
        recordInstalledProject(install, 'vale', key);
        return `installed Vale packages in ${GSPOT_PATHS.valePackages}`;
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
}

/**
Build the text of a vale.ini from its style folders and package sources.

@param ini the level, the style folders in the order Vale reads them, and the package sources.
@param ini.level recommended or all; level all adds the packages and their rules.
@param ini.stylesPaths the style folders; Vale installs packages in the last one.
@param ini.packages the package archives: each a URL or a local path.
@returns the vale.ini text.
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
    const formats = Object.entries(PROSE_GRAMMARS).flatMap(([extension, grammar]) =>
        'format' in grammar ? [[extension.slice(1), grammar.format] as const] : [],
    );
    const lines = [
        ...(isAll ? ['# Vale reads both StylesPath lines in order and installs packages in the last folder.'] : []),
        ...stylesPaths.map((path) => `StylesPath = ${path}`),
        'MinAlertLevel = suggestion',
        `SkippedScopes = ${VALE_SKIPPED_SCOPES}`,
        ...(isAll ? [`Packages = ${packages.join(', ')}`, 'Vocab = words'] : []),
        '',
        '[formats]',
        ...formats.map(([extension, format]) => `${extension} = ${format}`),
        '',
        '[*]',
        `BasedOnStyles = ${(isAll ? ['gspot', 'Vale', ...VALE_PACKAGES] : ['gspot']).join(', ')}`,
        `BlockIgnores = ${BLOCK_IGNORES.join(', ')}`,
        `TokenIgnores = ${TOKEN_IGNORES.join(', ')}`,
        ...(isAll ? Object.entries(VALE_OFF_RULES).flatMap(([rule, reason]) => [`# ${reason}`, `${rule} = NO`]) : []),
        '# Markup checks read markup only.',
        'gspot.alt-text = NO',
        ...(isAll ? VALE_MARKUP_RULES.map((rule) => `${rule} = NO`) : []),
        '',
        `[*.{${formats.map(([extension]) => extension).join(',')}}]`,
        'BasedOnStyles =',
        ...VALE_COMMENT_RULES.map((rule) => `${rule} = YES`),
        '',
        `[${VALE_MARKUP_FILES}]`,
        'gspot.alt-text = YES',
        ...(isAll ? VALE_MARKUP_RULES.map((rule) => `${rule} = YES`) : []),
    ];
    return lines.join('\n');
}
