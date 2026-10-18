/** Tool files and rules where gspot 0.2 wrote them, which the first apply after an upgrade removes. */
export const PREVIOUS_LAYOUT_FILES = {
    '.gspot/config/eslint.config.mjs': 'export default [];\n',
    '.gspot/config/vale.ini': 'StylesPath = vale/styles\n',
    '.gspot/config/vale/styles/gspot/dates.yml': 'extends: existence\n',
    '.gspot/config/semgrep/javascript.yml': 'rules: []\n',
    '.gspot/rules/general/prose/WRITING.md': '# Writing\n',
    '.gspot/rules/general/engineering/agent/WORKING.md': '# Working\n',
} as const;

/** The same files where gspot writes them now. */
export const CURRENT_LAYOUT_FILES = [
    '.gspot/configurations/language/javascript/eslint.mjs',
    '.gspot/configurations/general/prose/vale.ini',
    '.gspot/configurations/general/prose/styles/gspot/dates.yml',
    '.gspot/configurations/general/prose/rules/WRITING.md',
    '.gspot/configurations/general/engineering/rules/WORKING.md',
] as const;
