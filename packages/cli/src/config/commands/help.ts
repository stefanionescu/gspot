/** Command registration and reference pages share this help text. */
export const COMMAND_HELP = {
    init: {
        summary: 'Find what this repository needs, then write gspot.toml and the generated files',
        group: 'Set up a repository:',
        description:
            'Find the configurations this repository needs and print a plan. When you accept the plan, gspot writes\n`gspot.toml`, the tool files, the rules for coding agents, the Git hooks, and the CI workflow.\ninit deletes the tool files that gspot replaces. Git keeps their old content.\ninit installs no tools and runs no checks. Run `gspot install` next.',
        arguments: {},
        options: {
            '--yes': 'Accept the plan without a question (needed without a terminal)',
            '--dry-run': 'Print the plan and write nothing',
            '--from <template>':
                'Start from a template: a file path, an HTTPS URL, or `github:owner/repository[/path][@ref]`',
            '--configurations <names...>': 'Use these configurations at the root instead of the detected ones',
            '--no-configurations': 'Select no configurations at the root',
            '--json': 'Print the result as JSON. Needs `--yes` or `--dry-run`',
            '-h, --help': 'Print help',
        },
        exitCodes:
            '  0  The plan was written, printed, or declined.\n  2  An argument is not valid, or init could not finish.',
        example: 'gspot init --dry-run',
    },
    install: {
        summary: 'Install the tools and turn on the Git hooks in this clone',
        group: 'Set up a repository:',
        description:
            'Install the tools that `gspot.toml` needs, at the pinned versions:\n  - npm tools into `.gspot/node_modules`, from `.gspot/package-lock.json`\n  - Python tools into `.gspot/.venv`, from `.gspot/uv.lock`\n  - programs with mise, from `.gspot/mise.toml` (gspot runs `mise trust` for this file)\n\ninstall writes each missing or outdated lockfile. Commit the lockfiles.\ninstall also sets the Git setting `core.hooksPath` to `.gspot/hooks`, or removes it when you set `hooks.enabled` to false.\nWithout mise, install names the programs that you must install yourself.',
        arguments: {},
        options: {
            '--json': 'Print the result as JSON',
            '-h, --help': 'Print help',
        },
        exitCodes:
            '  0         The tools are installed, or the missing programs are named.\n  2         install could not finish. The error names the step that failed.\n  130, 143  Installation stopped because of Ctrl-C or SIGTERM.',
        example: 'gspot install',
    },
    apply: {
        summary: 'Write the generated files again from gspot.toml',
        group: 'Set up a repository:',
        description:
            'Write the tool files, the rules, the Git hooks, and the CI workflow again from `gspot.toml`.\napply replaces the generated files that gspot owns.\napply sets the version pin in `.gspot/version` to the gspot version that runs.\napply does not change `gspot.toml` and installs no tools. Run `gspot install` when apply says the tools changed.',
        arguments: {},
        options: {
            '--dry-run': 'Print the generated files that would change, with their differences, and write nothing',
            '--json': 'Print the result as JSON',
            '-h, --help': 'Print help',
        },
        exitCodes:
            '  0  The files were written, or the dry run finished.\n  2  gspot.toml is not valid, or apply could not finish.',
        example: 'gspot apply --dry-run',
    },
    check: {
        summary: 'Run the checks and print the findings',
        group: 'Run the checks:',
        description:
            'Run the checks and print each finding with its file, line, lint rule, and help.\nWithout options, gspot runs the commit and push checks on the working tree.\nCommit message checks run with `--hook commit-msg`. Manual checks run only when `--only` names them.',
        arguments: {
            paths: 'Files or folders to check (default: the whole repository)',
        },
        options: {
            '--only <checks...>': 'Run only these checks, such as `python/ruff`',
            '--staged': 'Check the staged content of the staged files',
            '--changed [ref]':
                'Check the files changed since ref (default: the upstream branch, else the default branch)',
            '--fix': 'Run the fixers, then run the checks on the fixed files',
            '--dry-run': 'With `--fix`: print the changes the fixers would make, and write nothing',
            '--hook <hook>':
                'Run as the Git hook runs: `pre-commit`, `pre-push`, or `commit-msg`. Put the arguments that Git gives the hook after `--`',
            '--verbose': 'Also print the passed and skipped checks, each command, and each ignore',
            '--json': 'Print the report as JSON',
            '-h, --help': 'Print help',
        },
        exitCodes:
            '  0         Every check that ran passed.\n  1         Findings remain.\n  2         A check could not run (a tool is missing or failed), a fixer failed,\n            or an argument is not valid.\n  130, 143  The run stopped because of Ctrl-C or SIGTERM.',
        example: 'gspot check --staged',
    },
    add: {
        summary: 'Select configurations',
        group: 'Change gspot.toml:',
        description:
            'Select configurations in `gspot.toml`, then write the generated files again.\ngspot also selects the configurations that they need, but `gspot.toml` lists only the names you give.\nRun `gspot install` next when the configurations need new tools.',
        arguments: {
            configuration: 'Configuration names, such as `pytest`. Run `gspot list` to see them',
        },
        options: {
            '--scope <path>': 'Select them in this scope only (default: the root)',
            '--json': 'Print the result as JSON',
            '-h, --help': 'Print help',
        },
        exitCodes:
            '  0  The configurations were added, or they were already selected.\n  2  An argument is not valid, or add could not finish.',
        example: 'gspot add pytest --scope services/api',
    },
    remove: {
        summary: 'Stop using configurations',
        group: 'Change gspot.toml:',
        description:
            'Stop using configurations, then write the generated files again.\n`gspot.toml` records the removal, so detection does not select them again. `gspot add` undoes it.\ngspot refuses to remove a configuration that another selected configuration needs.',
        arguments: {
            configuration: 'Configuration names',
        },
        options: {
            '--scope <path>': 'Remove them from this scope only (default: the root)',
            '--json': 'Print the result as JSON',
            '-h, --help': 'Print help',
        },
        exitCodes:
            '  0  The configurations were removed, or none of them was selected.\n  2  An argument is not valid, or remove could not finish.',
        example: 'gspot remove nextjs --scope apps/web',
    },
    set: {
        summary: 'Change a setting',
        group: 'Change gspot.toml:',
        description:
            'Change one setting in `gspot.toml`, then write the generated files again. gspot checks the value first.\nFor a list, gspot adds the values. For a table, give one TOML inline table, and gspot adds its entries.\nWrite `[[...]]` records, such as `[[command_check]]`, by hand.',
        arguments: {
            setting: 'The setting name, such as `limits.file_lines`. Run `gspot list settings` to see them',
            values: 'The new value, or the items or table entries to add',
        },
        options: {
            '--reason <text>': 'Why you change it. Needed when the change makes a check weaker',
            '--scope <path>': 'Change it in this scope only (default: the root)',
            '--json': 'Print the result as JSON',
            '-h, --help': 'Print help',
        },
        exitCodes:
            '  0  The setting was written.\n  2  The setting or the value is not valid, or set could not finish.',
        example: 'gspot set level all',
    },
    unset: {
        summary: 'Delete your value, so the default applies again',
        group: 'Change gspot.toml:',
        description:
            'Delete your value of a setting from `gspot.toml`, then write the generated files again.\nThe root value or the default applies again. With items, delete only those list items or table entries.',
        arguments: {
            setting: 'The setting name, such as `naming.banned_words`',
            items: 'List items or table entry names to delete (default: the whole value)',
        },
        options: {
            '--scope <path>': 'Change it in this scope only (default: the root)',
            '--json': 'Print the result as JSON',
            '-h, --help': 'Print help',
        },
        exitCodes:
            '  0  The value was deleted, or there was no value to delete.\n  2  The setting is not valid, or unset could not finish.',
        example: 'gspot unset level',
    },
    ignore: {
        summary: 'Turn off a check, or one lint rule, with a reason',
        group: 'Change gspot.toml:',
        description:
            'Turn off a check, or one of its lint rules, everywhere or for some paths.\nWithout a check, the paths stay out of every check and every tool file.\ngspot writes the ignore and your reason to `gspot.toml`, then writes the generated files again.\nEach report counts the ignores. `gspot check --verbose` prints them with their reasons.',
        arguments: {
            check: 'The check, such as `python/ruff`. Leave it out to keep --paths out of every check',
        },
        options: {
            '--reason <text>': 'Why you turn it off (required)',
            '--rule <rule>': 'Turn off only this lint rule',
            '--paths <glob...>': 'Turn it off only for these paths (default: every path)',
            '--until <date>': 'Turn it on again on this date, YYYY-MM-DD (UTC)',
            '--json': 'Print the result as JSON',
            '-h, --help': 'Print help',
        },
        exitCodes: '  0  The ignore was written.\n  2  An argument is not valid, or ignore could not finish.',
        example:
            'gspot ignore javascript/eslint --rule no-console --paths "scripts/**" --reason "Scripts print their results."',
    },
    unignore: {
        summary: 'Turn an ignored check on again',
        group: 'Change gspot.toml:',
        description:
            'Delete the ignores of a check from `gspot.toml`, then write the generated files again.\nWith `--rule`, delete only the ignores of that lint rule. With `--paths`, take those paths out of the ignores.\nAn ignore without paths covers every path, so `--paths` cannot narrow it. unignore keeps that ignore and says so.',
        arguments: {
            check: 'The check, such as `python/ruff`. Leave it out to change the ignores of every check',
        },
        options: {
            '--rule <rule>': 'Delete only the ignores of this lint rule',
            '--paths <glob...>': 'Take only these paths out of the ignores',
            '--json': 'Print the result as JSON',
            '-h, --help': 'Print help',
        },
        exitCodes:
            '  0  The ignores were deleted or changed, or no ignore matched.\n  2  An argument is not valid, or unignore could not finish.',
        example: 'gspot unignore javascript/eslint --rule no-console',
    },
    list: {
        summary: 'List the configurations or the settings',
        group: 'Look up:',
        description:
            'List the selected and the available configurations, with the state of each check in each scope.\ngspot list settings lists each setting, its value, and where the value comes from.\nlist changes nothing.',
        arguments: {
            what: 'What to list',
        },
        options: {
            '--json': 'Print the result as JSON, with long values in full',
            '-h, --help': 'Print help',
        },
        exitCodes: '  0  The list was printed.\n  2  gspot.toml is not valid, or list could not finish.',
        example: 'gspot list settings',
    },
    explain: {
        summary: 'Explain a check, lint rule, configuration, setting, or file',
        group: 'Look up:',
        description:
            'Explain one thing: what it means, its state in this repository, and the commands that change it.\nexplain changes nothing.',
        arguments: {
            subject:
                'A check (`python/ruff`), a lint rule (`eslint/no-console`), a configuration (`python`), a setting (`limits.file_lines`), or a file (`./src/app.ts`)',
        },
        options: {
            '--json': 'Print the result as JSON',
            '-h, --help': 'Print help',
        },
        exitCodes: '  0  The explanation was printed.\n  2  gspot knows no subject with this name.',
        example: 'gspot explain python/ruff',
    },
    doctor: {
        summary: 'Find setup problems and print the command that fixes each one',
        group: 'Look up:',
        description:
            'Find setup problems: missing or wrong tool versions, Git hooks that do not run, and configurations that the\nrepository needs but does not select.\nEach problem line shows the command that fixes it. doctor changes nothing.',
        arguments: {},
        options: {
            '--json': 'Print the full report as JSON, with the tools that are ready',
            '-h, --help': 'Print help',
        },
        exitCodes: '  0  No problem found.\n  1  A tool or a Git hook is not ready.\n  2  doctor could not finish.',
        example: 'gspot doctor',
    },
    export: {
        summary: 'Write gspot.toml as a template for other repositories',
        group: 'Share:',
        description:
            'Write `gspot.toml` as a template that other repositories can start from with `gspot init --from`.\nThe template leaves out the scopes. If a command check runs a script from this repository,\ncopy the script too. export does not change `gspot.toml`.',
        arguments: {
            file: 'The template file to write, such as `gspot.template.toml`',
        },
        options: {
            '--json': 'Print the result as JSON',
            '-h, --help': 'Print help',
        },
        exitCodes: '  0  The template was written.\n  2  The file name is not valid, or export could not finish.',
        example: 'gspot export gspot.template.toml',
    },
} as const;

export const HELP_TERM_WIDTH = 29;

/** The mark around code in the help text. */
export const CODE_MARK = '`';

export const PROGRAM_EXIT_CODES =
    '  0         The command finished. For check: no findings remain.\n  1         check found findings, or doctor found a setup problem.\n  2         The command could not finish, or an argument is not valid.\n  130, 143  check or install stopped because of Ctrl-C or SIGTERM.';

export const PROGRAM_HELP_FOOTER = `Options:\n  --version                    Print the version\n  -h, --help                   Print this help\n\nExit codes:\n${PROGRAM_EXIT_CODES}\n\nExample:\n  gspot init --dry-run\n\nRun gspot <command> --help to see the options of one command.\n`;
