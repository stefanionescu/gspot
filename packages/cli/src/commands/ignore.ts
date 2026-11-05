import { buildIgnorePaths, pathsOption, readIgnoreEditContext, writeSettingsEdit } from '#cli/commands/edits.ts';
import { IGNORE_CHECK_MESSAGE } from '#cli/config/commands/edits.ts';
import { REASON_OPTION, RULE_OPTION } from '#cli/config/commands/help.ts';
import { EVERY_CHECK } from '#cli/config/engine.ts';
import { RUFF_RULE_PREFIX } from '#cli/config/settings/schema.ts';
import { selectCheckCode } from '#cli/configurations/registry.ts';
import { readCheckRuleExplanation } from '#cli/configurations/rules.ts';
import { OUTPUT_FORMATS } from '#cli/engine/outputs/formats.ts';
import { hasRuleExplanations } from '#cli/engine/results.ts';
import { openSession } from '#cli/engine/session.ts';
import { assertCheckExists, listChecksById, readConfigurations } from '#cli/manifests/read.ts';
import { ignoreSchema } from '#cli/schemas/settings/file.ts';
import { mergeIgnore } from '#cli/settings/text.ts';
import { validateReason } from '#cli/settings/validation/reasons.ts';
import { GspotError } from '#cli/system/errors.ts';
import { formatNameList } from '#cli/system/text.ts';
import { findToolName } from '#cli/tools/pins.ts';
import type { CommandDefinition, IgnoreFlags, IgnoreOptions } from '#cli/types/commands/edits.ts';
import type { Check } from '#cli/types/manifests.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import type { CommandResult } from '#cli/types/system.ts';
import type { Session } from '#cli/types/tools.ts';

function formatIgnoreSummary(options: IgnoreOptions, paths: string[] | undefined): string {
    const check = options.check ?? EVERY_CHECK;
    const target = options.rule === undefined ? check : `rule ${options.rule} of ${check}`;
    const suffix = paths === undefined ? '' : ` for ${formatNameList(paths)}`;
    return `Ignored ${target}${suffix}.`;
}

function findRuleCheck({ settings }: Session, checkId: string): Check {
    const shippedCheck = listChecksById(readConfigurations().values()).get(checkId)?.check;
    const check = settings.commandChecks[checkId] ?? shippedCheck;
    if (
        check === undefined ||
        (!OUTPUT_FORMATS[check.output.format].namesRules(check.output) &&
            selectCheckCode(check)?.explanations === undefined)
    )
        throw new GspotError(
            'arguments',
            `gspot cannot ignore one lint rule of ${checkId}. Leave out --rule, and give --paths to ignore the check for those files.`,
        );
    return check;
}

async function assertDocumentedRule(
    session: Session,
    { checkId, rule }: { checkId: string; rule: string },
): Promise<void> {
    const check = findRuleCheck(session, checkId);
    if (!hasRuleExplanations(check, selectCheckCode(check))) return;
    if (findToolName(check) === 'ruff' && RUFF_RULE_PREFIX.test(rule)) return;
    const docs = await readCheckRuleExplanation(session.root, check, rule, session);
    if (docs === undefined) throw new GspotError('arguments', `gspot does not know rule ${rule} of ${checkId}.`);
}

async function runIgnoreCommand(options: IgnoreOptions): Promise<CommandResult> {
    const record = {
        check: options.check,
        rule: options.rule,
        paths: options.paths,
        reason: options.reason,
    };
    const valid = ignoreSchema.safeParse(record);
    if (!valid.success)
        throw new GspotError(
            'arguments',
            valid.error.issues.map((issue) => `--${issue.path.join('.')}: ${issue.message}`).join('\n'),
        );
    const context = await readIgnoreEditContext(options.root);
    const { root, edit: input, settings, cache, listing } = context;
    if (options.check !== undefined) assertCheckExists(options.check, Object.values(settings.commandChecks));
    if (options.rule !== undefined && options.check !== undefined) {
        const session = await openSession(root, { settings, cache, listing });
        await assertDocumentedRule(session, { checkId: options.check, rule: options.rule });
    }
    const paths = buildIgnorePaths(context, options.cwd, options.paths);
    const list = (input.table['ignore'] as TomlTable[] | undefined) ?? [];
    mergeIgnore(list, {
        ...(options.check !== undefined && { check: options.check }),
        ...(options.rule !== undefined && { rule: options.rule }),
        paths,
        reason: options.reason,
    });
    input.table['ignore'] = list;
    return await writeSettingsEdit(context, { summary: formatIgnoreSummary(options, paths) });
}

export const IGNORE_COMMAND: CommandDefinition<[string | undefined], IgnoreFlags> = {
    name: 'ignore',
    arguments: [{ term: '[check]' }],
    options: [{ flags: REASON_OPTION, required: true }, { flags: RULE_OPTION }, pathsOption],
    run: async ({ arguments: commandArguments, flags: { reason, rule, paths }, root, cwd }) => {
        const [check] = commandArguments;
        const message = validateReason(`gspot ignore ${check ?? ''}`.trimEnd(), reason, IGNORE_CHECK_MESSAGE);
        if (message !== undefined) throw new GspotError('arguments', message);
        return await runIgnoreCommand({ root, cwd, check, paths, rule, reason });
    },
};
