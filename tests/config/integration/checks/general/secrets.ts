export const API_TOKEN = 'n3K5p7R9' + 't2V4w6Y8' + 'z1A3c5E7' + 'g9I2m4O6';

export const AWS_KEY_ID = 'AKIA' + 'IOSFODNN7' + 'EXAMPLA';

const AWS_CREDENTIALS = `aws_access_key_id = "${AWS_KEY_ID}"\n`;

export const SECRET_FILES = {
    'credential,é.py': `api_key = "${API_TOKEN}"\n`,
    'identity.py': AWS_CREDENTIALS,
} as const;

export const FIXED_SECRET_FILES = {
    'credential,é.py': 'import os\napi_key = os.environ["API_KEY"]\n',
    'identity.py': 'import os\naws_access_key_id = os.environ["AWS_ACCESS_KEY_ID"]\n',
} as const;

export const DOTENV_LINTER_CASES = [
    {
        check: 'secrets/dotenv-linter',
        files: {
            '.env.example': 'PORT=3000\nsecret_key=example\n',
        },
        expected: { file: '.env.example', rule: 'LowercaseKey', line: 2 },
        corrected: { files: { '.env.example': 'PORT=3000\n' } },
    },
] as const;
