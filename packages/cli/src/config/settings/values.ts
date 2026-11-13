// naming categories
export const CATEGORY_KEY_SEGMENTS = 2;
export const CATEGORY_PARENTS: Readonly<Record<string, string>> = {
    classes: 'types',
    type_aliases: 'types',
    exceptions: 'types',
    methods: 'functions',
    constants: 'variables',
    attributes: 'properties',
    enum_cases: 'properties',
    modules: 'files',
    packages: 'folders',
};
export const NAMING_KEY_LENGTH = 4;

// setting defaults
export const LANGUAGE_GROUP_TABLES = new Set(['limits', 'naming']);
export const OVERRIDING_GROUPS = new Set<string>(['framework', 'platform', 'library', 'database']);
export const SHIPPED_DEFAULT_ORIGIN = 'gspot default';
export const SHIPPED_DEFAULT_OWNER = 'gspot';

// setting paths
export const GLOB_BRACKETS = /[()[\]]/u;
export const REASONED_VALUE_KEY = 'value';
export const RECORD_PATHS_KEY = 'paths';

// value words
export const BOOLEAN_WORDS: ReadonlySet<string> = new Set(['true', 'false']);
export const NUMBER_TEXT = /^-?\d+(?:\.\d+)?$/u;
export const TOML_COMPOUND_START = /^[[{]/u;
export const TOML_QUOTES = /^(["'])(.*)\1$/su;
