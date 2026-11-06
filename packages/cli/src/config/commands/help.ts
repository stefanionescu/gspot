export const SCOPE_OPTION = '--scope <path>';

export const REASON_OPTION = '--reason <text>';

export const RULE_OPTION = '--rule <rule>';

export const PATHS_OPTION = '--paths <path>';

export const COMMAND_HELP = {
    scan: {
        summary: 'Try gspot on a copy of this repository, and change nothing',
        group: 'Set up a repository:',
        description:
            'Try gspot on a temporary copy of your tracked files, with staged changes and without unstaged ones, so your repository stays as it is. In the copy, gspot writes what init writes, installs the tools, and runs the checks at the default level with no fixes. It runs no tests, no build, and no check that loads project code. It still loads your Prettier config, and it runs your installed ESLint, Stylelint, and TypeScript, so run it only on code that you trust.\n\nThe report gives the totals, the findings by category with three examples each, the files that differ from your style, how long each tool took on this scan, the plan of init, and the next steps.\n\nnpm, uv, and mise keep their download caches, so a second scan downloads no tool again, and tools that mise installs stay on this computer. Each scan still asks GitHub for the pinned releases, so set GITHUB_TOKEN if you scan often. After init, run `gspot check` instead.',
        arguments: {},
        options: {
            '--json': 'Print the report as JSON, with every finding',
        },
        exitCodes: [
            ['0', 'The report was printed, with or without findings.'],
            ['2', 'scan could not run.'],
            ['129, 130, 143', 'The scan stopped because of SIGHUP, Ctrl-C, or SIGTERM.'],
        ],
        example: 'gspot scan',
    },
    init: {
        summary: 'Find what this repository needs, write gspot.toml and the generated files, and install the tools',
        group: 'Set up a repository:',
        description:
            'Find the configurations this repository needs and print a plan. gspot writes gspot.toml and the generated files: config files for the tools, rule files for coding agents, and Git hooks. CI starts off; turn it on with `gspot set ci.enabled true`.\n\ninit deletes your tool configs that gspot replaces. Each one must be committed unchanged, so `git show HEAD:<path>` can restore it. Then init installs the tools and turns on the Git hooks, as `gspot install` does. It runs no checks. Its last line names the commands to run next.\n\nWith --from, init also selects the configurations of the gspot.toml of another repository, and copies its settings that fit any repository. The plan lists each one it leaves out.',
        arguments: {},
        options: {
            '--from <file>': "Start from another repository's gspot.toml",
            '--configurations <names>':
                'Use these configurations at the root; repeat the flag or separate names with commas',
            '--level <level>': 'Start at this level. Default: basic',
        },
        exitCodes: [
            ['0', 'The plan was written, and the tools are installed.'],
            ['1', 'The plan was written, and a tool is still missing. The output names it and the reason.'],
            ['2', 'An argument is not valid, or init could not finish.'],
            ['129, 130, 143', 'Installation stopped because of SIGHUP, Ctrl-C, or SIGTERM. The written files stay.'],
        ],
        example: 'gspot init --level all',
    },
    install: {
        summary: 'Write the generated files, install the tools, and turn on the Git hooks in this clone',
        group: 'Set up a repository:',
        description:
            'Write the generated files again from gspot.toml: config files for the tools, rule files, Git hooks, and the CI workflow. install replaces the generated files that gspot owns, and does not change gspot.toml.\n\nThen install the tools that gspot.toml needs, at the pinned versions:\n  - npm tools into .gspot/node_modules, from the lockfile in .gspot/\n  - Python tools into .gspot/.venv, from .gspot/uv.lock\n  - the other tools with mise, from .gspot/mise.toml\n\ninstall writes each missing or outdated lockfile. Commit the lockfiles.\n\nWhen nothing needs to change, install prints `No change`.\n\ninstall also sets the Git setting core.hooksPath to .gspot/hooks, or removes it when you set hooks.enabled to false. When another hook manager runs the hooks, install prints the line to add to each hook instead. Without mise, install names the tools that you must install yourself.',
        arguments: {},
        options: {},
        exitCodes: [
            ['0', 'The tools are installed.'],
            ['1', 'A tool is still missing or still fails after the install. The output names it and the reason.'],
            ['2', 'gspot.toml is not valid, or install could not finish. The error names the step that failed.'],
            ['129, 130, 143', 'Installation stopped because of SIGHUP, Ctrl-C, or SIGTERM.'],
        ],
        example: 'gspot install',
    },
    check: {
        summary: 'Run the checks and print the findings',
        group: 'Run the checks:',
        description:
            'Run the checks and print each finding with its file, line, lint rule, and help.\n\nWithout options, gspot runs the commit and push checks on the working tree. Checks of commit messages run in the commit-msg hook. Some slow checks run only when you name them with --only; gspot explain names their stage.',
        arguments: {
            '[paths...]': 'Files or folders to check, relative to the current folder (default: the whole repository)',
        },
        options: {
            '--only <checks>':
                'Run only these checks, including checks off at your level. Separate several with commas, or repeat the option. commit or push alone runs the checks of that stage at your level',
            '--skip <checks>': 'Run every check except these. Separate several with commas, or repeat the option',
            '--staged': 'Check the files as you staged them. The pre-commit hook adds --only commit',
            '--base <ref>': 'Check the files changed since this branch, tag, or commit',
            '--fix': 'Run the fixers, then run the checks on the fixed files',
            '--verbose': 'Also print the passed and skipped checks, each command, and each ignore',
        },
        exitCodes: [
            ['0', 'Every check that ran passed.'],
            ['1', 'Findings remain.'],
            ['2', 'A check could not run, a fixer failed, or an argument is not valid.'],
            ['129, 130, 143', 'The run stopped because of SIGHUP, Ctrl-C, or SIGTERM.'],
        ],
        example: 'gspot check --staged',
    },
    add: {
        summary: 'Add configurations',
        group: 'Change gspot.toml:',
        description:
            'Select configurations in gspot.toml, then write the generated files again. gspot also turns on the configurations that these need. gspot.toml lists only the names you typed.\n\nTo find the configurations that new code needs, run `gspot check --only gspot/detected-configurations`. It prints the `gspot add` line to run for each scope.\n\nRun `gspot install` next when the configurations need new tools.',
        arguments: {
            '<configuration...>': 'Configuration names, such as pytest. Run `gspot list` to see them',
        },
        options: {
            '--scope <path>': 'Apply to one project folder, by its path from the repository root, such as services/api',
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
            'Remove configurations, then write the generated files again. gspot.toml keeps your reason, so gspot does not suggest them again. `gspot add` undoes it.\n\ngspot refuses to remove a configuration that another selected configuration needs.',
        arguments: {
            '<configuration...>': 'Configuration names',
        },
        options: {
            '--scope <path>': 'Apply to one project folder, by its path from the repository root, such as services/api',
            '--reason <text>': 'Why you remove them (required)',
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
            'Change one setting in gspot.toml, then write the generated files again. gspot checks the value first.\n\nFor a list, give every item, because gspot replaces the whole list. To remove single items, run `gspot unset <setting> <items...>`. For a setting that holds a table, such as tools.eslint.rules, give one TOML inline table, and gspot adds its keys. spelling.allowed_words takes its words and one --reason instead.\n\nFor an ignore, run `gspot ignore <check> --reason "<why>"`. Write other records, such as [[command_check]], by hand.',
        arguments: {
            '<setting>': 'The setting name, such as limits.max_file_lines. Run `gspot list settings` to see them',
            '<values...>': 'The new value: every item of a list, or the table keys to add',
        },
        options: {
            '--reason <text>': 'Why you change it. A value weaker than the shipped default needs one',
            '--scope <path>': 'Apply to one project folder, by its path from the repository root, such as services/api',
        },
        exitCodes: [
            ['0', 'The setting was written, or it already had this value.'],
            ['2', 'The setting or the value is not valid, or set could not finish.'],
        ],
        example: 'gspot set level all',
    },
    unset: {
        summary: 'Remove your value, so the default applies again',
        group: 'Change gspot.toml:',
        description:
            'Remove your value of a setting from gspot.toml, then write the generated files again. The root value or the default applies again.\n\nGive items to remove only those items from a list, or only those keys from a table.',
        arguments: {
            '<setting>': 'The setting name, such as naming.banned_words',
            '[items...]': 'List items or table keys to remove (default: the whole value)',
        },
        options: {
            '--scope <path>': 'Apply to one project folder, by its path from the repository root, such as services/api',
        },
        exitCodes: [
            ['0', 'The value was removed, or there was no value to remove.'],
            ['2', 'The setting is not valid, or unset could not finish.'],
        ],
        example: 'gspot unset level',
    },
    ignore: {
        summary: 'Ignore a check, or one lint rule, with a reason',
        group: 'Change gspot.toml:',
        description:
            'Ignore a check, or one of its lint rules, everywhere or for some paths. Without a check, no check reads these paths.\n\ngspot writes the ignore and your reason to gspot.toml, then writes the generated files again. Each report counts the ignores. `gspot check --verbose` prints them with their reasons.',
        arguments: {
            '[check]': 'The check, such as python/ruff. Leave it out to skip the --paths files in every check',
        },
        options: {
            '--reason <text>': 'Why you ignore it (required)',
            '--rule <rule>': 'Ignore only this lint rule, or the finding with this fingerprint',
            '--paths <path>':
                'Ignore it for one path or glob relative to the current folder; repeat for more (default: every path)',
        },
        exitCodes: [
            ['0', 'The ignore was written, or it already existed.'],
            ['2', 'An argument is not valid, or ignore could not finish.'],
        ],
        example:
            'gspot ignore javascript/eslint --rule no-console --paths "scripts/**" \\\n    --reason "Scripts print their results."',
    },
    unignore: {
        summary: 'Remove ignores',
        group: 'Change gspot.toml:',
        description:
            'Remove the ignores of a check from gspot.toml, then write the generated files again.\n\nWith --rule, remove only the ignores of that lint rule. With --paths, take those paths out of the ignores. An ignore without paths covers every path, so --paths cannot narrow it. unignore keeps that ignore and says so.',
        arguments: {
            '[check]':
                'The check, such as python/ruff. Leave it out and pass --paths to change the ignores that cover every check',
        },
        options: {
            '--rule <rule>': 'Remove only the ignores of this lint rule',
            '--paths <path>': 'Remove one path or glob relative to the current folder from ignores; repeat for more',
        },
        exitCodes: [
            ['0', 'The ignores were removed or changed, or no ignore matched.'],
            ['2', 'An argument is not valid, or unignore could not finish.'],
        ],
        example: 'gspot unignore javascript/eslint --rule no-console',
    },
    list: {
        summary: 'List the configurations or the settings',
        group: 'Look up:',
        description:
            'List the selected and the available configurations, with the state of each check in each scope. `gspot list settings` lists each setting, its value, and where the value comes from.',
        arguments: {
            '[configurations|settings]': 'What to list',
        },
        options: {},
        exitCodes: [
            ['0', 'The list was printed.'],
            ['2', 'gspot.toml is not valid, or list could not finish.'],
        ],
        example: 'gspot list settings',
    },
    explain: {
        summary: 'Explain a check, lint rule, configuration, setting, or file',
        group: 'Look up:',
        description: 'Explain one thing: what it means, its state in this repository, and the commands that change it.',
        arguments: {
            '<subject>':
                'A check (python/ruff), a configuration (python), a setting (limits.max_file_lines), or a file (./src/app.ts)',
            '[rule]': 'A lint rule of the named check, such as E501 for python/ruff',
        },
        options: {},
        exitCodes: [
            ['0', 'The explanation was printed.'],
            [
                '2',
                'gspot knows no subject with this name, a ./ path is not a repository file, or gspot.toml is not valid.',
            ],
        ],
        example: 'gspot explain python/ruff',
    },
    doctor: {
        summary: 'Find setup problems and print the command that fixes each one',
        group: 'Look up:',
        description:
            'Find setup problems: missing or wrong tool versions, Git hooks that do not run, and a gspot version other than the pinned one.\n\nEach problem line says how to fix it: a command, or what to change.',
        arguments: {},
        options: {},
        exitCodes: [
            ['0', 'No problem found.'],
            ['1', 'A tool or a Git hook is not ready, or the repository pins another gspot version.'],
            ['2', 'doctor could not finish.'],
        ],
        example: 'gspot doctor',
    },
} as const;

export const CODE_MARK = '`';
