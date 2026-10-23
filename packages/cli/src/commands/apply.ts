import { openSession } from '#cli/session.ts';
import { formatCount } from '#cli/system/text.ts';
import { findRoot } from '#cli/repository/read.ts';
import { type Session } from '#cli/types/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { openWriter } from '#cli/apply/write/writer.ts';
import { type OutdatedFile } from '#cli/types/apply.ts';
import { type Command } from '@commander-js/extra-typings';
import cliPackage from '#cli-package' with { type: 'json' };
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { DRY_RUN_NOTE } from '#cli/config/commands/apply.ts';
import { readVersionPin } from '#cli/repository/version-pin.ts';
import { listOutdatedFiles } from '#cli/apply/files/outdated.ts';
import { writeSettings, readSettingsFile } from '#cli/settings/file.ts';
import { type DryRunJson, type ApplyOptions } from '#cli/types/commands/apply.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';
import { SETTINGS_FILE, SCHEMA_DIRECTIVE, SCHEMA_DIRECTIVE_LINE } from '#cli/config/settings/file.ts';
import { formatUpToDate, formatApplyReport, writeGeneratedFiles } from '#cli/apply/files/generated.ts';

function formatOutdatedFiles(outdatedFiles: OutdatedFile[]): string {
    const lines = [
        `${formatCount(outdatedFiles.length, 'generated file')} ${outdatedFiles.length === 1 ? 'needs' : 'need'} updating:`,
        '',
    ];
    for (const outdatedFile of outdatedFiles) {
        const differences = (outdatedFile.diff ?? '').split('\n').map((line) => `    ${line}`);
        lines.push(`  ${outdatedFile.path}  ${outdatedFile.kind}`);
        if ((outdatedFile.diff ?? '') !== '') lines.push(...differences);
    }
    lines.push('', 'Run gspot apply to write these files.');
    return `${lines.join('\n')}\n`;
}

function buildDryRunResult(session: Session): CommandResult {
    const generated = generate(session);
    const outdatedFiles = listOutdatedFiles(session, generated);
    const summary =
        outdatedFiles.length === 0 ? `${formatUpToDate(generated.files.length)}\n` : formatOutdatedFiles(outdatedFiles);
    const pin = { from: readVersionPin(session.root), to: cliPackage.version };
    const json: DryRunJson = { dryRun: true, pin, outdated: outdatedFiles };
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
