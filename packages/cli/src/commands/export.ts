import { realpathSync } from 'node:fs';
import { isOwned } from '#cli/ownership/plans.ts';
import { findRoot } from '#cli/repository/read.ts';
import { GspotError } from '#cli/system/errors.ts';
import { readSettings } from '#cli/settings/read.ts';
import { isGitRepository } from '#cli/system/git.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { printResult } from '#cli/system/terminal.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { type Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { type CommandResult } from '#cli/types/terminal.ts';
import { assertVersionPin } from '#cli/apply/version-pin.ts';
import { readIndexEntries } from '#cli/repository/tracked.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { dirname, resolve, basename, relative } from 'node:path';
import { OWNER_WRITABLE_FILE } from '#cli/config/system/modes.ts';
import { parseTemplate, exportTemplate } from '#cli/settings/templates.ts';
import { type ExportJson, type ExportOptions } from '#cli/types/commands/export.ts';

/**
 * Writes a template from the settings of this repository.
 * @param options the export destination.
 * @param options.cwd the directory the command runs in
 * @param options.file the destination path, relative to cwd
 * @returns the command result, with the omitted entries.
 */
export async function exportCommand(options: ExportOptions): Promise<CommandResult<ExportJson>> {
    const { cwd, file } = options;
    const parentPath = dirname(resolve(cwd, file));
    const root = findRoot(cwd);
    await assertVersionPin(root);
    const settingsFile = readSettings(root);
    const saved = exportTemplate(settingsFile.text);
    const template = parseTemplate(saved.text, file);
    let parent;
    try {
        parent = realpathSync(parentPath);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT')
            throw new GspotError('files', `The folder ${parentPath} does not exist.`);
        throw error;
    }
    using destination = openFiles(parent);
    const name = basename(file);
    const path = convertToPosixPath(relative(root, resolve(parent, name)));
    using disk = openFiles(root);
    if (path === SETTINGS_FILE || isOwned(path, disk))
        throw new GspotError('template', `gspot writes ${path} itself. Choose another file name.`);
    const index = isGitRepository(root) ? await readIndexEntries(root) : [];
    const tracked = new Set(index.map((entry) => entry.path));
    const checks = template.tables.command_check ?? [];
    const warnings = checks.flatMap((entry) => {
        const check = entry.name;
        const executable = entry.command[0] as string;
        return executable.startsWith('./') || tracked.has(executable)
            ? [`command_check ${check} uses ${executable}; add that file in the destination repository.`]
            : [];
    });
    const previous = destination.read(name);
    destination.write(
        name,
        { bytes: Buffer.from(saved.text), mode: previous === undefined ? OWNER_WRITABLE_FILE : previous.mode },
        previous,
    );
    const lines = [`wrote ${path}`, ...saved.leftOut.map((entry) => `left out  ${entry}`), ...warnings];
    return { text: `${lines.join('\n')}\n`, json: { file: path, leftOut: saved.leftOut, warnings }, exitCode: 0 };
}

/**
 * Register the export command.
 * @param program the command program
 */
export function registerExport(program: Command): void {
    program
        .command('export')
        .argument('<file>', COMMAND_HELP.export.arguments['file'])
        .summary(COMMAND_HELP.export.summary)
        .description(COMMAND_HELP.export.description)
        .action(async (file) => {
            printResult(await exportCommand({ cwd: process.cwd(), file }));
        });
}
