export const RECORD_DECLARATIONS = {
    'command_check.name': {
        description: 'The check ID that `--only` and `[[ignore]] check` use, which may not match a shipped check.',
    },
    'ignore.check': {
        description:
            'The check whose findings you accept: a shipped check or a command check. Leave it out to keep the paths out of every check.',
    },
    'ignore.rule': { description: 'One lint rule of that check.' },
    'ignore.names': {
        description: 'The function names that the ignore covers, such as a hook that a framework calls.',
    },
    'ignore.paths': { description: 'Where the ignore applies.' },
    'ignore.reason': { description: 'Why you accept the findings.' },
    'format.override.paths': { description: 'The files these formatting values apply to.' },
    'import_rule.name': { description: 'The name that other import rules use in can_also_import.' },
    'import_rule.paths': { description: 'The files of the import rule.' },
    'import_rule.can_also_import': { description: 'The import rules listed below this one that its files may import.' },
    'import_rule.can_import': {
        description:
            'Exactly the import rules whose files this rule may import, besides its own. Replaces the rules listed above it.',
    },
    'coverage.swift_target.name': { description: 'A Swift target named in the coverage report.' },
    'coverage.swift_target.lines': {
        description: 'The least share of lines that the target must cover, in place of `coverage.lines`.',
    },
    'coverage.swift_target.reason': { description: 'Why this target may cover less.' },
    'licenses.allowed_package.name': {
        description:
            'The package name, such as `lightningcss`, or a glob that covers one package built for each platform, such as `@img/sharp-libvips-*`.',
    },
    'licenses.allowed_package.version': {
        description:
            'An exact version, a semver range such as `^1.2.0`, or `*`; gspot reports a record that matches no locked package.',
    },
    'licenses.allowed_package.reason': { description: 'Why you accept its license; name the license here.' },
    'site.size_limit.paths': {
        description: 'Built files, such as `docs/dist/_astro/*.js`; the size check runs only when a record exists.',
    },
    'site.size_limit.kilobytes': { description: 'The most they may weigh together, compressed.' },
} as const;
