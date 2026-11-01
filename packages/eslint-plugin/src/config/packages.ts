export const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

export const PACKAGE_MANIFEST = 'package.json';

export const REPOSITORY_MARKER = '.git';

export const VERSION_PATTERN = /^(?<operator>[<>]=?|[~=^])?v?(?<number>[\d.xX*]+)(?:[-+][\w.]*)?$/u;

export const VERSION_NUMBER = /^(?:\d+|[xX*])$/u;

export const VERSION_WILDCARD = /^[xX*]$/u;

export const VERSION_OPERATORS = new Map([
    ['', 'exact'],
    ['=', 'exact'],
    ['^', 'caret'],
    ['~', 'tilde'],
    ['<', 'below'],
    ['<=', 'upto'],
    ['>', 'unbounded'],
    ['>=', 'unbounded'],
]);

export const VERSION_ALTERNATIVES = '||';

export const VERSION_SPACES = /\s+/u;

export const VERSION_SIZE = 3;

export const UNBOUNDED_VERSIONS = new Set(['', '*', 'x', 'X', 'latest']);

export const VUE_THREE = [3, 0, 0];
