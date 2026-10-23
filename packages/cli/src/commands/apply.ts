import { openSession } from '#cli/session.ts';
import { formatCount } from '#cli/system/text.ts';
import { findRoot } from '#cli/repository/read.ts';
import { type StaleFile } from '#cli/types/apply.ts';
import { type Session } from '#cli/types/session.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { generate } from '#cli/generation/generate.ts';
import { type Command } from '@commander-js/extra-typings';
import { listStaleFiles } from '#cli/apply/stale-files.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { DRY_RUN_NOTE } from '#cli/config/commands/apply.ts';
import { readVersionPin } from '#cli/repository/version-pin.ts';
import { writeSettings, readSettingsFile } from '#cli/settings/file.ts';
import { type DryRunJson, type ApplyOptions } from '#cli/types/commands/apply.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';
import { formatUpToDate, formatApplyReport, writeGeneratedFiles } from '#cli/apply/write.ts';
import { SETTINGS_FILE, SCHEMA_DIRECTIVE, SCHEMA_DIRECTIVE_LINE } from '#cli/config/settings/file.ts';

function formatStaleFiles(staleFiles: StaleFile[]): string {
    const lines = [
        `${formatCount(staleFiles.length, 'generated file')} ${staleFiles.length === 1 ? 'needs' : 'need'} updating:`,
        '',
    ];
    for (const entry of staleFiles) {
        const differences = (entry.diff ?? '').split('\n').map((line) => `    ${line}`);
        lines.push(`  ${entry.path}  ${entry.kind}`);
        if ((entry.diff ?? '') !== '') lines.push(...differences);
    }
    lines.push('', 'Run gspot apply to write these files.');
    return `${lines.join('\n')}\n`;
}

function buildDryRunResult(session: Session): CommandResult {
    const generated = generate(session);
    const staleFiles = listStaleFiles(session, generated);
    const summary =
        staleFiles.length === 0 ? `${formatUpToDate(generated.files.length)}\n` : formatStaleFiles(staleFiles);
    const pin = { from: readVersionPin(session.root), to: cliPackage.version };
    const json: DryRunJson = { dryRun: true, pin, stale: staleFiles };
    const version = pin.from === pin.to ? '' : `version ${pin.from ?? 'unpinned'} -> ${pin.to}\n`;
    return { text: `${version}${summary}${DRY_RUN_NOTE}\n`, json, exitCode: 0 };
}

/**
 * Write the generated files, or show the planned changes and write nothing.
 *
 * @param options the parsed flags.
 * @returns the command result.
 */
async function runApplyCommand(options: ApplyOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    const session = await openSession(root);
    if (options.isDryRun) return buildDryRunResult(session);
    using log = openWriter(root);
    const report = writeGeneratedFiles(session, generate(session), log);
    // Editors read the schema of the pinned version through the directive on the first line of gspot.toml.
    const settingsFile = readSettingsFile(root);
    if (!SCHEMA_DIRECTIVE_LINE.test(settingsFile.text)) {
        writeSettings(log, `${SCHEMA_DIRECTIVE}\n${settingsFile.text}`, settingsFile.original);
        report.updated.push(SETTINGS_FILE);
    }
    return { text: formatApplyReport(report), json: report, exitCode: 0 };
}

/**
 * Register the apply command.
 *
 * @param program the gspot program that gets the command.
 * @param onResult receives the result of the command.
 */
export function registerApply(program: Command, onResult: CommandCompletion): void {
    program
        .command('apply')
        .summary(COMMAND_HELP.apply.summary)
        .description(COMMAND_HELP.apply.description)
        .option('--dry-run', COMMAND_HELP.apply.options['--dry-run'])
        .action(async (flags) => {
            onResult(
                await runApplyCommand({
                    cwd: process.cwd(),
                    isDryRun: flags.dryRun === true,
                }),
            );
        });
}
