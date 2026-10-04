import { testApiToken, secretSettings } from '#tests/config/harness/secrets.ts';

export const TEST_SECRETS = {
    'credential,é.py': `api_key = "${testApiToken}"\n`,
    'identity.py': secretSettings,
};

export const CORRECTED_SECRETS = {
    'credential,é.py': 'import os\napi_key = os.environ["API_KEY"]\n',
    'identity.py': 'import os\naws_access_key_id = os.environ["AWS_ACCESS_KEY_ID"]\n',
};
