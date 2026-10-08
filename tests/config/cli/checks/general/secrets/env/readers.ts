export const READER_FILES = {
    'config/example.env': 'export KNOWN=example\n# ignored\n',
    'source.ts':
        'Bun.env.KNOWN; Bun.env.MISSING; process.env["MISSING"];\nconfig.$env("CUSTOM");\n$readEnv("DOLLAR");\notherconfig.$env("UNDECLARED"); process.env.MISSING;\n',
    'reader.py':
        'read_env("PYTHON"); read_env("PYTHON"); os.environ["MISSING"]; os.getenv("OTHER");\nos.environ.get("OTHER");\n',
    'notes.txt': 'Bun.env.TEXT; $readEnv("TEXT");\n',
};

export const READER_TABLES =
    '[secrets]\nenv_examples = ["config/example.env"]\nreader_functions = ["config.$env", "$readEnv", "read_env"]\n';

export const READER_TEMPLATE =
    'KNOWN=example\nMISSING=example\nCUSTOM=example\nDOLLAR=example\nPYTHON=example\nOTHER=example\n';

export const READER_FINDINGS = [
    {
        file: 'reader.py',
        line: 1,
        rule: 'missing-key',
        message: 'MISSING is read here and appears in no example environment file.',
    },
    {
        file: 'reader.py',
        line: 1,
        rule: 'missing-key',
        message: 'OTHER is read here and appears in no example environment file.',
    },
    {
        file: 'reader.py',
        line: 1,
        rule: 'missing-key',
        message: 'PYTHON is read here and appears in no example environment file.',
    },
    {
        file: 'source.ts',
        line: 1,
        rule: 'missing-key',
        message: 'MISSING is read here and appears in no example environment file.',
    },
    {
        file: 'source.ts',
        line: 2,
        rule: 'missing-key',
        message: 'CUSTOM is read here and appears in no example environment file.',
    },
    {
        file: 'source.ts',
        line: 3,
        rule: 'missing-key',
        message: 'DOLLAR is read here and appears in no example environment file.',
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
    '[secrets]\nreader_functions = ["root_env"]\n[scope."app"]\n[scope."app".secrets]\nenv_examples = ["project.env"]\nreader_functions = ["config.$env", "$readEnv"]\n[scope."sibling"]\n[scope."sibling".secrets]\nenv_examples = [".env.example"]\n';

export const PROJECT_READER_CORRECTIONS = {
    '.env.example': 'APP_MISSING=example\nROOT_MISSING=example\n',
    'app/project.env': 'APP_KEY=example\nSIBLING_MISSING=example\nAPP_MISSING=example\n',
    'sibling/.env.example': 'KNOWN=example\nSIBLING_MISSING=example\n',
};
