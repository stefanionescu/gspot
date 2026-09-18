// Environment-file patterns and template names. Literals only.

export const ENV_FILE_PATTERNS = ['.env', '.env.*', '.dev.vars', '.dev.vars.*'];

export const ENV_TEMPLATE_NAMES = ['.env.example', '.env.template', '.env.sample', '.dev.vars.example'];

export const ENV_KEY_LINE = /^(?:export\s+)?[A-Z_][A-Z0-9_]*=/;
