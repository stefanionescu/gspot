// Saves a reusable policy template.
import { resolve, relative } from 'node:path';
import { readPolicy } from '#cli/policy/read.ts';
import { toPosix } from '#cli/platform/paths.ts';
import { findRoot } from '#cli/repository/root.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { printResult } from '#cli/output/messages.ts';
import type { CommandResult } from '#cli/types/output.ts';
import type { Program } from '#cli/types/commands/program.ts';
import { applyPlans } from '#cli/lifecycle/ownership/commit.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { assertMutationTarget } from '#cli/platform/root/rules.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/platform/modes.ts';
import { proposeReplacement } from '#cli/lifecycle/ownership/plans.ts';
import { parseTemplate, exportTemplate } from '#cli/policy/templates.ts';

/**
 * Writes a template from the policy of this repository.
 * @param cwd the directory the command runs in
 * @param file the file to write, relative to cwd
 * @returns the command result, with what was left out
 */
export function exportCommand(cwd: string, file: string): CommandResult {
    const root = findRoot(cwd);
    const policyFile = readPolicy(root);
    const saved = exportTemplate(policyFile.text, file);
    const path = toPosix(relative(root, resolve(cwd, file)));
    assertMutationTarget(path);
    // Refuse a template that cannot parse back before writing its destination.
    parseTemplate(saved.text, file);
    using log = openOwnership(root);
    if (log.files.read('gspot.toml')?.bytes.toString('utf8') !== policyFile.text)
        throw new GspotError('policy', ['The policy changed while the template was prepared. Retry the export.']);
    const owned = log.state.files.find((entry) => entry.path === path);
    if (owned !== undefined && owned.kind !== 'export')
        throw new GspotError('policy', [`Template export cannot replace managed ${path}. Choose another destination.`]);
    const onDisk = log.files.read(path);
    const plan = proposeReplacement(log, {
        path,
        next: { bytes: Buffer.from(saved.text), mode: onDisk?.mode ?? OWNER_WRITABLE_FILE },
        kind: 'export',
    });
    applyPlans(log, [plan]);
    const lines = [`wrote ${file}`, ...saved.leftOut.map((entry) => `left out  ${entry}`)];
    return { text: `${lines.join('\n')}\n`, json: { file, leftOut: saved.leftOut }, exitCode: 0 };
}

/**
 * Registers export.
 * @param program the commander program
 */
export function registerExport(program: Program): void {
    program
        .command('export')
        .argument('<file>', 'Destination path for the reusable template')
        .summary('Export a template')
        .description(
            'Write the policy to a template other repositories can start from. Settings that name a path stay out, and export lists them. gspot.toml does not change.',
        )
        .addHelpText(
            'after',
            '\nExit codes:\n- 0: the template was written.\n- 2: the input was invalid, or export could not finish.\n\nExample:\ngspot export team.gspot.template.toml',
        )
        .action((file, _flags, command) => {
            const global = command.optsWithGlobals();
            const cwd = resolve(global.C ?? process.cwd());
            printResult(exportCommand(cwd, file));
        });
}
