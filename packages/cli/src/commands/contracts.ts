// One claimed policy edit validates the authored values, then applies prepared outputs without installing tools.
// Saves a reusable policy template.
import { lstatSync } from 'node:fs';
import { createTwoFilesPatch } from 'diff';
import { readPolicy } from '#cli/policy/public.ts';
import { emitAll } from '#cli/generation/public.ts';
import { GspotError } from '#cli/platform/public.ts';
import { openRoot } from '#cli/platform/root/public.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import { canonicalPath } from '#cli/platform/root/reads.ts';
import { EXIT_ERROR } from '#cli/config/platform/runtime.ts';
import type { Program } from '#cli/types/commands/program.ts';
import { compact, toPosix } from '#cli/platform/contracts.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { readIndexEntries } from '#cli/repository/contracts.ts';
import type { ApplyReport } from '#cli/types/lifecycle/apply.ts';
import { noteLines, printResult } from '#cli/terminal/public.ts';
import { writePolicyFile } from '#cli/policy/document/public.ts';
import { findRoot } from '#cli/repository/discovery/contracts.ts';
import type { PreparedPolicy } from '#cli/types/policy/settings.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/platform/modes.ts';
import { planReplacement } from '#cli/lifecycle/ownership/contracts.ts';
import { applyPlan, openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { join, win32, dirname, resolve, basename, relative } from 'node:path';
import type { ExportJson, ExportOptions } from '#cli/types/commands/export.ts';
import { commandHelp, commandRoot, openSession } from '#cli/commands/public.ts';
import { assertVersionPin, writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import type { InstallJson, InstallOptions } from '#cli/types/commands/install.ts';
import { installTools, installationPlan } from '#cli/lifecycle/install/public.ts';
import type { PolicySaveResult, SavePolicyOptions } from '#cli/types/commands/save-policy.ts';
import { editPolicy, parseTemplate, exportTemplate } from '#cli/policy/document/contracts.ts';

// Both failure phases report native errors and non-Error throws with the same text.
function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Render the canonical policy diff from the transaction's already captured proposal.
 * @param result the prepared policy with its original bytes
 * @param summary the command's description of the requested edit
 * @returns the preview without writing policy or generated files
 */
function planPolicy(result: PreparedPolicy, summary: string): PolicySaveResult {
    const diff = result.changed
        ? createTwoFilesPatch(POLICY_FILE, POLICY_FILE, result.original.bytes.toString('utf8'), result.text)
        : '';
    const text = `${summary}\n${diff}(dry run: gspot.toml not written)\n`;
    return {
        text,
        json: { changed: result.changed, policy: result.text, diff, dryRun: true },
        exitCode: 0,
    };
}

/**
 * Registers tool and hook installation.
 * @param program the command-line program
 */
export function registerInstall(program: Program): void {
    program
        .command('install')
        .summary('Install the locked tools')
        .description(
            'Install the tools gspot.toml selects, at the versions in the committed lockfiles, and the selected Git hooks. install prepares missing or outdated tool lockfiles before installing. Run it after you clone a configured repository. If a package install fails, the previous lockfiles and installation stay. --refresh-lockfiles resolves the declared pins again before installation. --dry-run prints the commands and writes nothing.',
        )
        .addHelpText('after', commandHelp('install'))
        .option('--dry-run', 'Print the install commands and write nothing')
        .option('--refresh-lockfiles', 'Resolve the declared tool pins again and install the prepared lockfiles')
        .action(async (flags, command) => {
            printResult(
                await installCommand({
                    cwd: commandRoot(command),
                    isDryRun: flags.dryRun === true,
                    refreshLockfiles: flags.refreshLockfiles === true,
                }),
            );
        });
}

/**
 * Preview or install this clone's locked tools without regenerating tracked configuration.
 * @param options the working directory and whether this is a dry run
 * @returns the text to print and the exit code
 */
export async function installCommand(options: InstallOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    assertVersionPin(root);
    const session = await openSession(root);
    const generated = emitAll(session);
    const { steps, notes, hooks } = installationPlan(session, generated, options.refreshLockfiles === true);
    if (options.isDryRun) {
        const lines = [...steps.map((step) => step.join(' ')), ...notes];
        return {
            text: lines.length === 0 ? 'No managed tools or hooks to install.\n' : `${lines.join('\n')}\n`,
            json: { dryRun: true, steps, notes, ...compact({ hooks }) } satisfies InstallJson,
            exitCode: 0,
        };
    }
    using log = openOwnership(root);
    const { note, exitCode } = await installTools(session, log, generated, {
        refreshLockfiles: options.refreshLockfiles === true,
    });
    return {
        text: `${note === '' ? 'No managed tools to install.' : note}\n`,
        json:
            exitCode === 0
                ? ({ installed: true, steps } satisfies InstallJson)
                : ({ installed: false, error: 'installation', message: note } satisfies InstallJson),
        exitCode,
    };
}

/**
 * Preview or apply one policy change through the same validated transaction.
 * @param root the repository root
 * @param options the authored change, summary, and preview choice
 * @returns the prepared policy diff or the result of applying generated outputs
 */
export async function savePolicy(root: string, options: SavePolicyOptions): Promise<PolicySaveResult> {
    const { input, change, summary, isDryRun } = options;
    using log = isDryRun ? undefined : openOwnership(root);
    const result = { ...editPolicy(root, input, change), original: input.original };
    if (log === undefined) return planPolicy(result, summary);
    if (!result.changed)
        return {
            text: 'gspot.toml already says this; nothing to apply.\n',
            json: { changed: false },
            exitCode: 0,
        };
    const session = await openSession(root, {
        policy: result.policy,
        text: result.text,
        path: join(root, POLICY_FILE),
        errors: [],
    });
    let generated;
    try {
        generated = emitAll(session);
    } catch (error) {
        const reason = errorText(error);
        return {
            text: `The policy change was not written: ${reason}\nResolve that, then retry the command.\n`,
            json: { error: 'preparation', changed: false, applied: false, message: reason },
            exitCode: EXIT_ERROR,
        };
    }
    writePolicyFile({
        files: log.files,
        text: result.text,
        original: result.original,
        publish: (next, expected) => {
            applyPlan(log, {
                ...planReplacement(log, { path: POLICY_FILE, next, kind: 'policy', canReplace: true, expected }),
                before: expected,
            });
        },
    });
    let applied: ApplyReport;
    try {
        applied = writeGeneratedFiles(session, generated, log);
    } catch (error) {
        // The policy is written by now, so the result says it keeps the change and how to finish.
        const reason = errorText(error);
        return {
            text: `${summary}\ngspot.toml keeps this change, and applying it stopped: ${reason}\nResolve that, then run gspot apply.\n`,
            json: { error: 'apply', changed: result.changed, applied: false, message: reason },
            exitCode: EXIT_ERROR,
        };
    }
    const notes = noteLines(applied.notes);
    return {
        text: `${summary}\n${notes}`,
        json: { changed: result.changed, notes: applied.notes },
        exitCode: 0,
    };
}

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
            printResult(await exportCommand({ cwd: commandRoot(command), file, isDryRun: flags.dryRun === true }));
        });
}
