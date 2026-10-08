import { testApiToken, secretSettings } from '#tests/config/samples/secrets.ts';

export const TEST_SECRETS = {
    'credential,é.py': `api_key = "${testApiToken}"\n`,
    'identity.py': secretSettings,
};

export const CORRECTED_SECRETS = {
    'credential,é.py': 'import os\napi_key = os.environ["API_KEY"]\n',
    'identity.py': 'import os\naws_access_key_id = os.environ["AWS_ACCESS_KEY_ID"]\n',
};

export const FILE_SCOPES = [
    ['root', ''],
    ['child', 'app/'],
] as const;

export const FILE_EXPIRIES = [
    ['expired', '2000-01-01', ['credential,é.py:generic-api-key:1', 'identity.py:aws-access-token:1']],
    ['active', '2999-01-01', ['credential,é.py:generic-api-key:1']],
] as const;
