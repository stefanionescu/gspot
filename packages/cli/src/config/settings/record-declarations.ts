export const RECORD_DECLARATIONS = {
    'command_check.name': {
        description: 'The check ID that `--only` and `[[ignore]] check` use, which may not match a shipped check.',
    },
    'ignore.check': { description: 'The check whose findings you accept: a shipped check or a command check.' },
    'ignore.rule': { description: 'One lint rule of that check.' },
    'ignore.paths': { description: 'Where the ignore applies.' },
    'ignore.reason': { description: 'Why you accept the findings.' },
    'format.override.paths': { description: 'The files these formatting values apply to.' },
    'architecture.module.name': { description: 'The name that other modules use in may_import.' },
    'architecture.module.paths': { description: 'The files of the module.' },
    'architecture.module.may_import': { description: 'The modules it may import, besides itself.' },
    'coverage.swift_target.name': { description: 'A Swift target named in the coverage report.' },
    'coverage.swift_target.lines': {
        description: 'The least share of lines that the target must cover, in place of `coverage.lines`.',
    },
    'coverage.swift_target.reason': { description: 'Why this target may cover less.' },
    'licenses.allowed_package.name': {
        description: 'The package name, such as `lightningcss` or `@fontsource-variable/geist`.',
    },
    'licenses.allowed_package.version': {
        description: 'The exact installed version; gspot reports a record that matches no installed package.',
    },
    'licenses.allowed_package.reason': { description: 'Why you accept its license; name the license here.' },
    'site.size_limit.paths': {
        description: 'Built files, such as `docs/dist/_astro/*.js`; the size check runs only when a record exists.',
    },
    'site.size_limit.kilobytes': { description: 'The most they may weigh together, compressed.' },
} as const;
