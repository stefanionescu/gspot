export const MALFORMED_COMPILER_CONFIGURATIONS = [
    ['{"extends":"./.gspot/tsconfig.json", invalid}', 'Property assignment expected.'],
    ['null', "The root value of a 'tsconfig.json' file must be an object."],
    ['[]', "The root value of a 'tsconfig.json' file must be an object."],
] as const;
