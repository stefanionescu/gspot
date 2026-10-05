import type { PathContainer } from '#cli/types/checks/general/naming.ts';

export const RESERVED_USES: Record<string, string[]> = {
    directory: ['directories', 'packages'],
    'file stem': ['files', 'modules'],
    variable: ['variables', 'constants', 'parameters'],
    property: ['properties', 'attributes', 'enum_cases'],
    field: ['properties', 'attributes'],
    'identifier word': ['*'],
};

export const DIGIT = /\d/u;

export const TEST_GROUP = 'tests group';

export const VERB_CATEGORIES = new Set(['functions', 'methods', 'variables']);

/** The leading verb allowed only in framework callback positions. */
export const CALLBACK_VERB = 'handle';

/** The identifier categories a setting can narrow to; every other category borrows the limits of one of these. */
export const CATEGORY_PARENTS: Record<string, string> = {
    classes: 'types',
    type_aliases: 'types',
    exceptions: 'types',
    methods: 'functions',
    constants: 'variables',
    attributes: 'properties',
    enum_cases: 'properties',
    modules: 'files',
    packages: 'directories',
};

export const REACT_FILE = /\.[jt]sx$/u;

export const MIGRATION_PREFIX = /^\d{14}_/u;

export const WRAPPERS: PathContainer[] = [
    { open: '[', close: ']', category: 'path_parameters' },
    { open: '(', close: ')', category: 'directories' },
    { open: '@', close: '', category: 'directories' },
    { open: '_', close: '', category: 'directories' },
];
