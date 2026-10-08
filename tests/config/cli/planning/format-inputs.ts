/** Source files outside the Prettier extension set still receive EditorConfig checks. */
export const EDITORCONFIG_INPUTS = {
    'source.py': 'VALUE = 1\n',
    'task.sh': '#!/bin/sh\nprintf hello\n',
    'Source.swift': 'let value = 1\n',
    'settings.toml': 'value = 1\n',
    'query.sql': 'SELECT 1;\n',
    Makefile: 'build:\n\ttrue\n',
    Dockerfile: 'FROM scratch\n',
};

export const FORMAT_POLICY = 'configurations = ["format"]\nrunner = "mise"\n[agent_rules]\nenabled = false\n';

export const PRETTIER_PATH_IGNORE =
    '\n[[ignore]]\ncheck = "format/prettier"\npaths = ["**/*.json"]\nreason = "These files retain generated formatting."\n';

export const AUTHORED_IGNORE_CHECK = `
configurations = []
[agent_rules]
enabled = false

[check."custom/native-ignore"]
command = ["bash", "-c", "true"]
stage = "commit"
ignore_file = "project.ignore"
paths = ["**/*.json"]
summary = "Checks the selected source files."
help = "Run the custom command to check the source files."
`;
