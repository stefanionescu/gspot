export const READER_FILES = {
    '.env.example': 'KNOWN=example\n',
    'source.ts':
        'Bun.env.KNOWN; Bun.env.MISSING; Bun.env["MISSING"];\nconfig.$env("CUSTOM");\n$readEnv("DOLLAR");\notherconfig.$env("UNDECLARED");\n',
    'reader.py': 'read_env("PYTHON"); read_env("PYTHON");\n',
    'notes.txt': 'Bun.env.TEXT; $readEnv("TEXT");\n',
};

export const READER_TABLES = '[env]\nreader_functions = ["config.$env", "$readEnv", "read_env"]\n';

export const READER_TEMPLATE = 'KNOWN=example\nMISSING=example\nCUSTOM=example\nDOLLAR=example\nPYTHON=example\n';

export const READER_FINDINGS = [
    {
        file: 'reader.py',
        line: 1,
        rule: 'missing-key',
        message: 'PYTHON is read here and appears in no environment template.',
    },
    {
        file: 'source.ts',
        line: 1,
        rule: 'missing-key',
        message: 'MISSING is read here and appears in no environment template.',
    },
    {
        file: 'source.ts',
        line: 2,
        rule: 'missing-key',
        message: 'CUSTOM is read here and appears in no environment template.',
    },
    {
        file: 'source.ts',
        line: 3,
        rule: 'missing-key',
        message: 'DOLLAR is read here and appears in no environment template.',
    },
];

export const PROJECT_READER_FILES = {
    '.env.example': 'APP_MISSING=example\n',
    'source.ts': 'root_env("ROOT_MISSING");\n',
    'app/project.env': 'APP_KEY=example\nSIBLING_MISSING=example\n',
    'app/source.ts': 'config.$env("APP_KEY"); $readEnv("APP_MISSING");\n',
    'sibling/.env.example': 'KNOWN=example\n',
    'sibling/source.ts': 'Bun.env.SIBLING_MISSING;\n',
};

export const PROJECT_READER_TABLES =
    '[env]\nreader_functions = ["root_env"]\n[[scope]]\npath = "app"\n[scope.env]\ntemplates = ["project.env"]\nreader_functions = ["config.$env", "$readEnv"]\n[[scope]]\npath = "sibling"\n';

export const PROJECT_READER_CORRECTIONS = {
    '.env.example': 'APP_MISSING=example\nROOT_MISSING=example\n',
    'app/project.env': 'APP_KEY=example\nSIBLING_MISSING=example\nAPP_MISSING=example\n',
    'sibling/.env.example': 'KNOWN=example\nSIBLING_MISSING=example\n',
};
