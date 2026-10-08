// Saves a reusable policy template.
import { lstatSync } from 'node:fs';
import { readPolicy } from '#cli/policy/read.ts';
import { toPosix } from '#cli/platform/paths.ts';
import { findRoot } from '#cli/repository/root.ts';
import { commandHelp } from '#cli/commands/help.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { printResult } from '#cli/terminal/messages.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import { canonicalPath } from '#cli/platform/root/reads.ts';
import type { Program } from '#cli/types/commands/program.ts';
import { readIndexEntries } from '#cli/repository/tracked.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/platform/modes.ts';
import { win32, dirname, resolve, basename, relative } from 'node:path';
import { parseTemplate, exportTemplate } from '#cli/policy/templates.ts';
import type { ExportJson, ExportOptions } from '#cli/types/commands/export.ts';

/**
 * Writes a template from the policy of this repository.
 * @param options the export destination and preview choice.
 * @param options.cwd the directory the command runs in
 * @param options.file the destination path, relative to cwd
 * @param options.isDryRun whether to preview without writing
 * @returns the command result, with what was left out.
 */
export async function exportCommand(options: ExportOptions): Promise<CommandResult<ExportJson>> {
    const { cwd, file, isDryRun } = options;
    if (win32.parse(file).root.endsWith(':'))
        throw new GspotError('policy', [
            'Template export cannot use a drive-relative destination. Choose an absolute or repository-relative path.',
        ]);
    const parentPath = dirname(resolve(cwd, file));
    if (lstatSync(parentPath).isSymbolicLink())
        throw new GspotError('policy', [
            'Template export cannot write through a linked parent directory. Choose its real path.',
        ]);
    const root = findRoot(cwd);
    const policyFile = readPolicy(root);
    const saved = exportTemplate(policyFile.text, file);
    const template = parseTemplate(saved.text, file);
    const parent = canonicalPath(parentPath);
    using destination = openRoot(parent);
    const name = basename(file);
    const path = toPosix(relative(root, resolve(parent, name)));
    using log = openOwnership(root);
    if (path === POLICY_FILE || log.state.files.some((entry) => entry.path === path))
        throw new GspotError('policy', [`Template export cannot replace managed ${path}. Choose another destination.`]);
    const index = await readIndexEntries(root);
    const tracked = new Set(index.map((entry) => entry.path));
    const checks = template.tables.check === undefined ? [] : Object.entries(template.tables.check);
    const warnings = checks.flatMap(([check, entry]) => {
        const [executable] = entry.command;
        return executable !== undefined && (executable.startsWith('./') || tracked.has(executable))
            ? [`check.${JSON.stringify(check)} uses ${executable}; add that file in the destination repository.`]
            : [];
    });
    const previous = destination.read(name);
    const json: ExportJson = { file, leftOut: saved.leftOut, warnings, text: saved.text };
    let preview = saved.text;
    let action = 'would write';
    if (!isDryRun) {
        destination.write(
            name,
            { bytes: Buffer.from(saved.text), mode: previous === undefined ? OWNER_WRITABLE_FILE : previous.mode },
            previous,
        );
        delete json.text;
        preview = '';
        action = 'wrote';
    }
    const lines = [`${action} ${file}`, ...saved.leftOut.map((entry) => `left out  ${entry}`), ...warnings];
    return { text: `${lines.join('\n')}\n${preview}`, json, exitCode: 0 };
}

/**
 * Registers export.
 * @param program the commander program.
 */
export function registerExport(program: Program): void {
    program
        .command('export')
        .argument('<file>', 'Destination path for the reusable template')
        .summary('Export a template')
        .description(
            'Write the policy to a template other repositories can start from. Every authored entry is copied except scopes, which export lists. Add any local command files in the destination repository. gspot.toml does not change.',
        )
        .addHelpText('after', commandHelp('export'))
        .option('--dry-run', 'Print the template without writing its destination')
        .action(async (file, flags, command) => {
            const global = command.optsWithGlobals();
            const cwd = resolve(global.C ?? process.cwd());
            printResult(await exportCommand({ cwd, file, isDryRun: flags.dryRun === true }));
        });
}
