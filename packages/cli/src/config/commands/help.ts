/** The help text shared by command registration and the command reference. */
export const COMMAND_HELP = {
    init: {
        summary: 'Set up gspot in this repository',
        description:
            'Find the configurations this repository needs, print the plan, and write it when you accept: gspot.toml, the tool files, the rules, the Git hooks, and the CI workflow. The plan turns on the Git hooks and the rules, and a CI workflow when the repository is on GitHub or GitLab and has no lint job yet. With --from, the template decides them. Change them afterwards with gspot set. init deletes the tool files it replaces, and Git keeps the old copies. init installs no tools and runs no checks: run gspot install next.',
        arguments: {},
        options: {
            '--yes': 'Write the plan without asking',
            '--from <template>': 'Start from a template: a path, an https URL, or github:owner/repo[/path][@ref]',
            '--configurations <names...>':
                'Use these configurations at the root instead of the detected ones. Write none for no configurations',
            '--dry-run': 'Print the plan and write nothing',
            '--json': 'Print the result as JSON. Needs --yes or --dry-run',
            '-h, --help': 'Print help for the command',
        },
        exitCodes:
            '- 0: the plan was written, printed, or declined.\n- 2: the input was invalid, or gspot init could not finish.',
        example: 'gspot init --dry-run',
    },
    install: {
        summary: 'Install the tools and turn the Git hooks on or off',
        description:
            'Install the tools gspot.toml needs: the npm and Python tools into .gspot/ at the versions in its lockfiles, and the program tools with mise at the versions in .gspot/mise.toml. Without mise, it installs the npm tools, and the Python tools when uv is on PATH, and prints one line that names every program you must install. It also turns the Git hooks on or off as gspot.toml says. A missing or out-of-date lockfile is made first. Run it after init, after you clone a repository that uses gspot, and when apply says the tools changed. If it fails, fix the error it prints and run it again.',
        arguments: {},
        options: {
            '--json': 'Print the result as JSON',
            '-h, --help': 'Print help for the command',
        },
        exitCodes:
            '- 0: the tools are installed, or the missing programs are named.\n- 2: the input was invalid, or gspot install could not finish.',
        example: 'gspot install',
    },
    apply: {
        summary: 'Write the generated files from gspot.toml',
        description:
            'Add the configurations the repository now needs to gspot.toml, then write the tool files, rules, Git hooks, and CI workflow from gspot.toml. A generated file you edited stays as it is, and apply names it. apply installs no tools: run gspot install after it.',
        arguments: {},
        options: {
            '--dry-run': 'Print the changes, with each lint rule that turns on or off, and write nothing',
            '--json': 'Print the result as JSON',
            '-h, --help': 'Print help for the command',
        },
        exitCodes:
            '- 0: the generated files were written, or the dry run finished.\n- 2: the input was invalid, or gspot apply could not finish.',
        example: 'gspot apply --dry-run',
    },
    check: {
        summary: 'Run the checks',
        description:
            'Run the checks and print each finding with its file, line, lint rule, and help. Without paths or options, gspot checks every file in the working tree.',
        arguments: {
            paths: 'Files or folders to check. Leave out to check the whole repository',
        },
        options: {
            '--only <checks...>': 'Run only these checks, such as python/ruff',
            '--staged': 'Check only the staged files, as they are staged',
            '--changed': 'Check only the files changed since the upstream or default branch',
            '--base <ref>': 'Use this branch, tag, or commit instead of the upstream branch. Turns on --changed',
            '--fix': 'Run the fixers, then run the checks again',
            '--dry-run': 'Print the changes the fixers would make, and write nothing. Turns on --fix',
            '--hook <hook>': 'Run the checks of this Git hook, as the hook does. Put the arguments Git passes after --',
            '--message-file <path>': 'Check this commit message file, as the commit-msg hook does',
            '--verbose': 'Print every finding, each command gspot runs, and each ignore with its reason',
            '--json': 'Print the report as JSON',
            '-h, --help': 'Print help for the command',
        },
        exitCodes:
            '- 0: every check that ran passed. The report lists the skipped checks.\n- 1: findings remain.\n- 2: the run could not finish: a tool is missing, a fixer failed, a report is invalid, or the input is invalid.\n- 130 or 143: the run was stopped (Ctrl-C or SIGTERM). The exitCode in the --json report is the same.',
        example: 'gspot check --staged',
    },
    add: {
        summary: 'Select configurations',
        description:
            'Select configurations in gspot.toml and write the generated files. The configurations they need are selected too, but gspot.toml lists only the names you give. Run gspot install next if they need new tools.',
        arguments: {
            configuration: 'Configuration names, such as pytest. gspot list shows them all',
        },
        options: {
            '--scope <path>': 'Select them in this scope only',
            '--json': 'Print the result as JSON',
            '-h, --help': 'Print help for the command',
        },
        exitCodes: '- 0: the configurations were added.\n- 2: the input was invalid, or gspot add could not finish.',
        example: 'gspot add pytest --scope services/api',
    },
    remove: {
        summary: 'Remove configurations',
        description:
            'Remove configurations from gspot.toml and write the generated files. gspot remembers the removal, so detection does not select them again. gspot add undoes it. gspot refuses to remove a configuration that another selected configuration needs.',
        arguments: {
            configuration: 'Configuration names to remove',
        },
        options: {
            '--scope <path>': 'Remove them from this scope only',
            '--json': 'Print the result as JSON',
            '-h, --help': 'Print help for the command',
        },
        exitCodes:
            '- 0: the configurations were removed, or none was selected.\n- 2: the input was invalid, or gspot remove could not finish.',
        example: 'gspot remove nextjs --scope apps/web',
    },
    set: {
        summary: 'Change a setting',
        description:
            'Change one setting in gspot.toml and write the generated files. gspot checks the value first. For a list, the values are added to it. For a table such as tools.eslint.rules, give one TOML inline table, and its entries are added. A command such as ci.setup_command is replaced whole. Record lists such as [[command_check]] are written by hand. Run gspot install next if the change needs new tools.',
        arguments: {
            setting: 'The setting name, such as limits.file_lines. gspot list settings shows them all',
            values: 'The new value, or the items or table entries to add',
        },
        options: {
            '--reason <text>': 'Why you change it. Needed when the change makes a check weaker',
            '--scope <path>': 'Change the setting in this scope only',
            '--json': 'Print the result as JSON',
            '-h, --help': 'Print help for the command',
        },
        exitCodes:
            '- 0: the setting was written and applied.\n- 2: the input was invalid, or gspot set could not finish.',
        example: 'gspot set level all',
    },
    unset: {
        summary: 'Delete your value of a setting',
        description:
            'Delete your value of a setting from gspot.toml and write the generated files. The root value or the default applies again. With items, take only those items out of a list, or only those entries out of a table such as tools.eslint.rules. A setting with one value takes no items.',
        arguments: {
            setting: 'The setting name, such as naming.banned_words',
            items: 'List items or table entry names to take out. Leave out to delete your whole value',
        },
        options: {
            '--scope <path>': 'Change the setting in this scope only',
            '--json': 'Print the result as JSON',
            '-h, --help': 'Print help for the command',
        },
        exitCodes:
            '- 0: the value was deleted and applied, or there was no value to delete.\n- 2: the input was invalid, or gspot unset could not finish.',
        example: 'gspot unset level',
    },
    ignore: {
        summary: 'Ignore a check or one of its lint rules',
        description:
            'Turn off a check, or one of its lint rules, for some paths or everywhere. gspot writes the ignore with your reason to gspot.toml and writes the generated files. Each report counts the ignores, and gspot check --verbose prints them with their reasons.',
        arguments: {
            check: 'The check to turn off, such as python/ruff',
        },
        options: {
            '--reason <text>': 'Why you ignore it (required)',
            '--rule <rule>': 'Turn off only this lint rule of the check',
            '--paths <glob...>': 'Turn it off only for these paths',
            '--json': 'Print the result as JSON',
            '-h, --help': 'Print help for the command',
            '--until <date>': 'Stop ignoring it on this date, YYYY-MM-DD (UTC)',
        },
        exitCodes:
            '- 0: the ignore was written and applied.\n- 2: the input was invalid, or gspot ignore could not finish.',
        example:
            'gspot ignore javascript/eslint --rule no-console --paths "scripts/**" --reason "Scripts print their results."',
    },
    unignore: {
        summary: 'Stop ignoring a check',
        description:
            'Stop ignoring a check: delete its ignores from gspot.toml and write the generated files. With --rule, delete only the ignores of that lint rule. With --paths, take those paths out of the ignores that list them, and delete an ignore that has no path left. An ignore without paths covers every path: --paths leaves it, and unignore says so.',
        arguments: {
            check: 'The ignored check, such as python/ruff',
        },
        options: {
            '--rule <rule>': 'Delete only the ignores of this lint rule',
            '--paths <glob...>': 'Take only these paths out of the ignores',
            '--json': 'Print the result as JSON',
            '-h, --help': 'Print help for the command',
        },
        exitCodes:
            '- 0: the matching ignores were deleted or changed, or none matched.\n- 2: the input was invalid, or gspot unignore could not finish.',
        example: 'gspot unignore javascript/eslint --rule no-console',
    },
    list: {
        summary: 'List configurations or settings',
        description:
            'List the selected and available configurations, with the state of each check in each scope. gspot list settings lists each setting, its value, and where the value comes from. Long values are cut short, and --json prints them in full. list changes nothing.',
        arguments: {
            what: 'What to list',
        },
        options: {
            '--json': 'Print the result as JSON',
            '-h, --help': 'Print help for the command',
        },
        exitCodes: '- 0: the list was printed.\n- 2: the input was invalid, or gspot list could not finish.',
        example: 'gspot list settings',
    },
    explain: {
        summary: 'Explain a check, lint rule, configuration, setting, or file',
        description:
            'Explain a check, a lint rule, a configuration, a setting, or a file: what it is, its state in this repository, and the commands that change it. explain changes nothing.',
        arguments: {
            subject:
                'A check (python/ruff), lint rule (eslint/no-console), configuration (python), setting (limits.file_lines), or file (./src/app.ts)',
        },
        options: {
            '--json': 'Print the result as JSON',
            '-h, --help': 'Print help for the command',
        },
        exitCodes: '- 0: the explanation was printed.\n- 2: the subject is unknown, or the input was invalid.',
        example: 'gspot explain python/ruff',
    },
    doctor: {
        summary: 'Check the gspot setup',
        description:
            'Report the tools, Git hooks, CI workflow, rules, and gspot version. Suggest configurations to add or remove and tool files to delete. List the lint jobs you already run and the submodules gspot does not read. doctor changes nothing. Each line that needs work shows the command that fixes it.',
        arguments: {},
        options: {
            '--json': 'Print the result as JSON',
            '-h, --help': 'Print help for the command',
        },
        exitCodes:
            '- 0: the selected tools and hooks are ready.\n- 1: a selected tool is missing, invalid, newer, or outdated, or a hook is not ready.\n- 2: gspot doctor could not finish.',
        example: 'gspot doctor',
    },
    export: {
        summary: 'Write a template for other repositories',
        description:
            'Write gspot.toml as a template that other repositories can start from with gspot init --from. The template leaves out scopes. If a command check runs a script from this repository, copy the script too. gspot.toml does not change.',
        arguments: {
            file: 'The template file to write, such as gspot.template.toml',
        },
        options: {
            '--json': 'Print the result as JSON',
            '-h, --help': 'Print help for the command',
        },
        exitCodes: '- 0: the template was written.\n- 2: the input was invalid, or gspot export could not finish.',
        example: 'gspot export gspot.template.toml',
    },
} as const;
