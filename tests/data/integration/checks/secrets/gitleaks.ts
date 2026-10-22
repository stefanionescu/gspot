import { API_TOKEN, AWS_CREDENTIALS } from '#tests/data/checks/secrets.ts';

export const SECRET_FILES = {
    'credential,é.py': `api_key = "${API_TOKEN}"\n`,
    'identity.py': AWS_CREDENTIALS,
} as const;

export const FIXED_SECRET_FILES = {
    'credential,é.py': 'import os\napi_key = os.environ["API_KEY"]\n',
    'identity.py': 'import os\naws_access_key_id = os.environ["AWS_ACCESS_KEY_ID"]\n',
} as const;
