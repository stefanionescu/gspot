import type { CommandHelp } from '#cli/types/commands/help.ts';
import { LEVEL_SUMMARY, ALL_LEVEL_SUMMARY } from '#cli/config/policy/settings.ts';

/** Exit descriptions and examples shared by native help and the command reference. */
export const COMMAND_HELP: Record<string, CommandHelp> = {
    apply: {
        exitCodes:
            '- 0: the generated files were written, or the dry run finished.\n- 2: the input was invalid, or apply could not finish.',
        examples: 'gspot apply --dry-run\ngspot apply',
    },
    install: {
        exitCodes:
            '- 0: the tools were installed, or the dry run finished.\n- 2: the input was invalid, or install could not finish.',
        examples: 'gspot install --dry-run',
    },
    add: {
        exitCodes:
            '- 0: the configurations were added, or the dry run finished.\n- 2: the input was invalid, or add could not finish.',
        examples: 'gspot add bash --dry-run\ngspot add pytest --scope services/api',
    },
    remove: {
        exitCodes:
            '- 0: the configuration was removed, or the dry run finished.\n- 2: the input was invalid, or remove could not finish.',
        examples: 'gspot remove bash --dry-run\ngspot remove nextjs --scope apps/web',
    },
    export: {
        exitCodes: '- 0: the template was written.\n- 2: the input was invalid, or export could not finish.',
        examples: 'gspot export team.template.toml\ngspot --json export team.template.toml',
    },
    ignore: {
        exitCodes:
            '- 0: the ignore was written and applied, or the dry run finished.\n- 2: the input was invalid, or ignore could not finish.',
        examples:
            'gspot ignore bash/syntax --paths scripts/example.sh --reason "The file tests a syntax error."\ngspot ignore javascript/eslint --rule no-console --paths "scripts/**" --reason "Scripts print their results."',
    },
    set: {
        exitCodes:
            '- 0: the setting was written and applied, or the dry run finished.\n- 2: the input was invalid, or set could not finish.',
        examples: 'gspot set level all',
        levels: `${LEVEL_SUMMARY}\n\n${ALL_LEVEL_SUMMARY}`,
    },
    list: {
        exitCodes: '- 0: the list was printed.\n- 2: the input was invalid, or list could not finish.',
        examples: 'gspot list settings\ngspot list configurations',
    },
    init: {
        exitCodes:
            '- 0: the plan was written, shown, or declined.\n- 2: the input was invalid, or init could not finish.',
        examples: 'gspot init --yes --configurations bash\ngspot init --dry-run --yes',
    },
    check: {
        exitCodes:
            '- 0: every check that ran passed. The report lists the skipped checks.\n- 1: findings remain, or a fix failed.\n- 2: the run could not finish: a tool is missing, a report is invalid, or the input is invalid.',
        examples: 'gspot check --staged\ngspot check --base origin/main',
    },
    explain: {
        exitCodes: '- 0: the explanation was printed.\n- 2: the subject is unknown, or the input was invalid.',
        examples: 'gspot explain bash/syntax\ngspot explain ./src/app.ts',
    },
    doctor: {
        exitCodes:
            '- 0: the selected tools and hooks are ready.\n- 1: a selected tool is missing, invalid, newer, or outdated, or a hook is not ready.\n- 2: doctor could not finish.',
        examples: 'gspot doctor\ngspot --json doctor',
    },
};
