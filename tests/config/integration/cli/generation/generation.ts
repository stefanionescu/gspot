// The literal values integration/cli/generation/generation reads: names, patterns, limits, and tables.

export const SHARED_SETTINGS_PACKAGE = '{"private":true,"type":"module"}\n';
export const MANAGED_IGNORES_CONFIGURATION =
    '\n[configuration]\nname = "local"\nkind = "policy"\ntitle = "Local"\ndescription = "Local tool files for the native ignore case."\n';
export const TAILWIND_AT_RULES = [
    'tailwind',
    'apply',
    'layer',
    'theme',
    'utility',
    'variant',
    'custom-variant',
    'source',
    'plugin',
    'config',
    'reference',
];
export const PYTHON = 'version = 1\nconfigurations = ["python"]\n';
export const PLANTED = {
    'package.json': '{"name":"planted","private":true,"type":"module"}\n',
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src"]}\n',
    'pyproject.toml': '[project]\nname = "planted"\nversion = "1.0.0"\n',
    'src/index.ts': 'export const answer = 42;\n',
};
