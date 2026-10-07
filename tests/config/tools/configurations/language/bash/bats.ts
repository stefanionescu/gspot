/** The syntax checker has ordinary Bash input; Bats must refuse an older parsing runtime. */
export const BATS_MINIMUM_FILES = {
    '.gitignore': 'bin/\n',
    'script.sh': 'printf "%s\\n" example\n',
    'script.bats': '@test "broken" {\n    if then\n}\n',
};
