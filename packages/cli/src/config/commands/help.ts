import { NAMED_FINDING_CHECKS } from '#cli/config/settings/gspot-toml.ts';

/** Command registration and reference pages share this help text. */
export const COMMAND_HELP = {
    init: {
        summary: 'Find what this repository needs, then write gspot.toml and the generated files',
        group: 'Set up a repository:',
        description:
            'Find the configurations this repository needs and print a plan. When you accept the plan, gspot writes `gspot.toml`, the config files, the rules for coding agents, the Git hooks, and the CI workflow.\n\ninit deletes the config files that gspot replaces. Git keeps their old content. init installs no tools and runs no checks. Run `gspot install` next.',
        arguments: {},
        options: {
            '--yes': 'Accept the plan without a question (needed without a terminal)',
            '--dry-run': 'Print the plan and write nothing',
            '--configurations <names...>': 'Use these configurations at the root instead of the detected ones',
            '--no-configurations': 'Select no configurations at the root',
            '--level <level>': 'Start at this level, so the plan replaces the config files that this level runs',
            '--json': 'Print the result as JSON. Needs `--yes` or `--dry-run`',
        },
        exitCodes: [
            ['0', 'The plan was written, printed, or declined.'],
            ['2', 'An argument is not valid, or init could not finish.'],
        ],
        example: 'gspot init --dry-run',
    },
    install: {
        summary: 'Install the tools and turn on the Git hooks in this clone',
        group: 'Set up a repository:',
        description:
            'Install the tools that `gspot.toml` needs, at the pinned versions:\n  - npm tools into `.gspot/node_modules`, from `.gspot/package-lock.json`\n  - Python tools into `.gspot/.venv`, from `.gspot/uv.lock`\n  - programs with mise, from `.gspot/mise.toml` (gspot runs `mise trust` for this file)\n\ninstall writes each missing or outdated lockfile. Commit the lockfiles.\n\ninstall also sets the Git setting `core.hooksPath` to `.gspot/hooks`, or removes it when you set `hooks.enabled` to false. Without mise, install names the programs that you must install yourself.',
        arguments: {},
        options: {
            '--json': 'Print the result as JSON',
        },
        exitCodes: [
            ['0', 'The tools are installed, or the missing programs are named.'],
            ['2', 'install could not finish. The error names the step that failed.'],
            ['130, 143', 'Installation stopped because of Ctrl-C or SIGTERM.'],
        ],
        example: 'gspot install',
    },
    apply: {
        summary: 'Write the generated files again from gspot.toml',
        group: 'Set up a repository:',
        description:
            'Write the config files, the rules, the Git hooks, and the CI workflow again from `gspot.toml`. apply replaces the generated files that gspot owns, and sets the version pin in `.gspot/version` to the gspot version that runs.\n\napply does not change `gspot.toml` and installs no tools. Run `gspot install` when apply says the tools changed.',
        arguments: {},
        options: {
            '--dry-run': 'Print the generated files that would change, with their differences, and write nothing',
            '--json': 'Print the result as JSON',
        },
        exitCodes: [
            ['0', 'The files were written, or the dry run finished.'],
            ['2', 'gspot.toml is not valid, or apply could not finish.'],
        ],
        example: 'gspot apply --dry-run',
    },
    check: {
        summary: 'Run the checks and print the findings',
        group: 'Run the checks:',
        description:
            'Run the checks and print each finding with its file, line, lint rule, and help.\n\nWithout options, gspot runs the commit and push checks on the working tree. Commit message checks run with `--hook commit-msg`. Manual checks run only when `--only` names them.',
        arguments: {
            paths: 'Files or folders to check (default: the whole repository)',
        },
        options: {
            '--only <checks>':
                'Run only these checks, such as `python/ruff`. Separate several with commas, or repeat the option',
            '--staged': 'Check the files as you staged them, not the working tree',
            '--changed [ref]':
                'Check the files changed since ref (default: the upstream branch, else the default branch)',
            '--fix': 'Run the fixers, then run the checks on the fixed files',
            '--dry-run': 'With `--fix`: print the changes the fixers would make, and write nothing',
            '--hook <hook>':
                'Run as the Git hook runs: `pre-commit`, `pre-push`, or `commit-msg`. Put the arguments that Git gives the hook after `--`',
            '--verbose': 'Also print the passed and skipped checks, each command, and each ignore',
            '--json': 'Print the report as JSON',
        },
        exitCodes: [
            ['0', 'Every check that ran passed.'],
            ['1', 'Findings remain.'],
            ['2', 'A check could not run (a tool is missing or failed), a fixer failed, or an argument is not valid.'],
            ['130, 143', 'The run stopped because of Ctrl-C or SIGTERM.'],
        ],
        example: 'gspot check --staged',
    },
    add: {
        summary: 'Add configurations',
        group: 'Change gspot.toml:',
        description:
            'Select configurations in `gspot.toml`, then write the generated files again. gspot also selects the configurations that they need, but `gspot.toml` lists only the names you give.\n\nRun `gspot install` next when the configurations need new tools.',
        arguments: {
            configuration: 'Configuration names, such as `pytest`. Run `gspot list` to see them',
        },
        options: {
            '--scope <path>': 'Select them in this scope only (default: the root)',
            '--json': 'Print the result as JSON',
        },
        exitCodes: [
            ['0', 'The configurations were added, or they were already selected.'],
            ['2', 'An argument is not valid, or add could not finish.'],
        ],
        example: 'gspot add pytest --scope services/api',
    },
    remove: {
        summary: 'Remove configurations, with a reason',
        group: 'Change gspot.toml:',
        description:
            'Remove configurations, then write the generated files again. `gspot.toml` records the removal and your reason, so `gspot doctor` does not suggest them again. `gspot add` undoes it.\n\ngspot refuses to remove a configuration that another selected configuration needs.',
        arguments: {
            configuration: 'Configuration names',
        },
        options: {
            '--scope <path>': 'Remove them from this scope only (default: the root)',
            '--reason <text>': 'Why you remove them (required)',
            '--json': 'Print the result as JSON',
        },
        exitCodes: [
            ['0', 'The configurations were removed, or none of them was selected.'],
            ['2', 'An argument is not valid, or remove could not finish.'],
        ],
        example: 'gspot remove nextjs --scope apps/web --reason "The site is a static export."',
    },
    set: {
        summary: 'Change a setting',
        group: 'Change gspot.toml:',
        description:
            'Change one setting in `gspot.toml`, then write the generated files again. gspot checks the value first.\n\nFor a list, gspot adds the values. For a table, give one TOML inline table, and gspot adds its keys.\n\nFor an ignore, run `gspot ignore <check> --reason "<why>"`. Write other records, such as `[[command_check]]`, by hand.',
        arguments: {
            setting: 'The setting name, such as `limits.file_lines`. Run `gspot list settings` to see them',
            values: 'The new value, or the list items or table keys to add',
        },
        options: {
            '--reason <text>': 'Why you change it. Needed when the change makes a check weaker',
            '--scope <path>': 'Change it in this scope only (default: the root)',
            '--json': 'Print the result as JSON',
        },
        exitCodes: [
            ['0', 'The setting was written, or it already had this value.'],
            ['2', 'The setting or the value is not valid, or set could not finish.'],
        ],
        example: 'gspot set level all',
    },
    unset: {
        summary: 'Delete your value, so the default applies again',
        group: 'Change gspot.toml:',
        description:
            'Delete your value of a setting from `gspot.toml`, then write the generated files again. The root value or the default applies again.\n\nWith items, delete only those list items or table keys.',
        arguments: {
            setting: 'The setting name, such as `naming.banned_words`',
            items: 'List items or table keys to delete (default: the whole value)',
        },
        options: {
            '--scope <path>': 'Change it in this scope only (default: the root)',
            '--json': 'Print the result as JSON',
        },
        exitCodes: [
            ['0', 'The value was deleted, or there was no value to delete.'],
            ['2', 'The setting is not valid, or unset could not finish.'],
        ],
        example: 'gspot unset level',
    },
    ignore: {
        summary: 'Turn off a check, or one lint rule, with a reason',
        group: 'Change gspot.toml:',
        description:
            'Turn off a check, or one of its lint rules, everywhere or for some paths. Without a check, the paths stay out of every check and every config file.\n\ngspot writes the ignore and your reason to `gspot.toml`, then writes the generated files again. Each report counts the ignores. `gspot check --verbose` prints them with their reasons.',
        arguments: {
            check: 'The check, such as `python/ruff`. Leave it out to keep --paths out of every check',
        },
        options: {
            '--reason <text>': 'Why you turn it off (required)',
            '--rule <rule>': 'Turn off only this lint rule',
            '--names <names...>': `Turn it off only for the definitions with these names, for ${new Intl.ListFormat('en', { type: 'conjunction' }).format(NAMED_FINDING_CHECKS)}`,
            '--paths <path...>': 'Turn it off only for these paths (default: every path)',
            '--until <date>': 'Report the ignore as expired from this date, YYYY-MM-DD (UTC)',
            '--json': 'Print the result as JSON',
        },
        exitCodes: [
            ['0', 'The ignore was written, or it already existed.'],
            ['2', 'An argument is not valid, or ignore could not finish.'],
        ],
        example:
            'gspot ignore javascript/eslint --rule no-console --paths "scripts/**" --reason "Scripts print their results."',
    },
    unignore: {
        summary: 'Turn an ignored check on again',
        group: 'Change gspot.toml:',
        description:
            'Delete the ignores of a check from `gspot.toml`, then write the generated files again.\n\nWith `--rule`, delete only the ignores of that lint rule. With `--paths`, take those paths out of the ignores. An ignore without paths covers every path, so `--paths` cannot narrow it. unignore keeps that ignore and says so.',
        arguments: {
            check: 'The check, such as `python/ruff`. Leave it out to change the ignores that cover every check',
        },
        options: {
            '--rule <rule>': 'Delete only the ignores of this lint rule',
            '--paths <path...>': 'Take only these paths out of the ignores',
            '--json': 'Print the result as JSON',
        },
        exitCodes: [
            ['0', 'The ignores were deleted or changed, or no ignore matched.'],
            ['2', 'An argument is not valid, or unignore could not finish.'],
        ],
        example: 'gspot unignore javascript/eslint --rule no-console',
    },
    list: {
        summary: 'List the configurations or the settings',
        group: 'Look up:',
        description:
            'List the selected and the available configurations, with the state of each check in each scope. gspot list settings lists each setting, its value, and where the value comes from.\n\nlist changes nothing.',
        arguments: {
            kind: 'What to list',
        },
        options: {
            '--json': 'Print the result as JSON, with long values in full',
        },
        exitCodes: [
            ['0', 'The list was printed.'],
            ['2', 'gspot.toml is not valid, or list could not finish.'],
        ],
        example: 'gspot list settings',
    },
    explain: {
        summary: 'Explain a check, lint rule, configuration, setting, or file',
        group: 'Look up:',
        description:
            'Explain one thing: what it means, its state in this repository, and the commands that change it.\n\nexplain changes nothing.',
        arguments: {
            subject:
                'A check (`python/ruff`), a lint rule (`eslint/no-console`), a configuration (`python`), a setting (`limits.file_lines`), or a file (`./src/app.ts`)',
        },
        options: {
            '--json': 'Print the result as JSON',
        },
        exitCodes: [
            ['0', 'The explanation was printed.'],
            ['2', 'gspot knows no subject with this name.'],
        ],
        example: 'gspot explain python/ruff',
    },
    doctor: {
        summary: 'Find setup problems and print the command that fixes each one',
        group: 'Look up:',
        description:
            'Find setup problems: missing or wrong tool versions, Git hooks that do not run, and configurations that the repository needs but does not select.\n\nEach problem line says how to fix it: a command, or what to change. doctor changes nothing.',
        arguments: {},
        options: {
            '--json': 'Print the full report as JSON, with the tools that are ready',
        },
        exitCodes: [
            ['0', 'No problem found.'],
            ['1', 'A tool or a Git hook is not ready.'],
            ['2', 'doctor could not finish.'],
        ],
        example: 'gspot doctor',
    },
} as const;
