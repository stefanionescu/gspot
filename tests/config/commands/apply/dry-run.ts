export const MISSING_GENERATED_PATHS = [
    '.editorconfig',
    '.gitattributes',
    '.gspot/.gitignore',
    '.gspot/configurations/general/data-files/taplo.toml',
    '.gspot/configurations/general/data-files/v8r.yml',
    '.gspot/configurations/general/data-files/yamllint.yml',
    '.gspot/configurations/general/dependencies/osv-scanner.toml',
    '.gspot/configurations/general/docs/lychee.toml',
    '.gspot/configurations/general/format/prettier.json',
    '.gspot/configurations/general/prose/styles/LICENSES.md',
    '.gspot/configurations/general/prose/styles/gspot/alt-text.yml',
    '.gspot/configurations/general/prose/styles/gspot/dates.yml',
    '.gspot/configurations/general/prose/styles/gspot/link-text.yml',
    '.gspot/configurations/general/prose/vale.ini',
    '.gspot/configurations/general/secrets/gitleaks.toml',
    '.gspot/configurations/general/spelling/typos.toml',
    '.gspot/configurations/language/bash/semgrep.yml',
    '.gspot/configurations/language/bash/shellcheckrc',
    '.gspot/gspot.schema.json',
    '.gspot/mise.lock',
    '.gspot/mise.toml',
    '.gspot/package-lock.json',
    '.gspot/package.json',
    '.gspot/pyproject.toml',
    '.gspot/uv.lock',
    '.gspot/version',
    '.prettierignore',
    'prettier.config.mjs',
] as const;

export const APPLY_WRITE_MESSAGE = 'Run gspot apply to write these files.';

export const INSTALL_WRITE_MESSAGE = 'Run gspot install to write the tool lockfiles.';
