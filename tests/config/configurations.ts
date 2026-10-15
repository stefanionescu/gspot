export const SEMGREP_ASSETS = [
    'configurations/language/example/semgrep/first.yml',
    'configurations/language/example/semgrep/second.yml',
    'configurations/language/example/semgrep/not-a-pack.txt',
] as const;

export const CONFIGURATION_TABLE = `
[configuration]
title = "Local"
description = "A local configuration used by manifest loading."
`;

export const ALWAYS_SELECTED = [
    'commits',
    'dependencies',
    'docs',
    'duplication',
    'engineering',
    'files',
    'format',
    'gspot',
    'naming',
    'prose',
    'repository',
    'secrets',
    'security',
    'spelling',
    'structure',
] as const;
