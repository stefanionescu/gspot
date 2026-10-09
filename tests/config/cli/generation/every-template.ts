export const PROJECT_FILES = {
    'package.json': '{"name":"example","private":true,"type":"module"}\n',
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src"]}\n',
    'pyproject.toml': '[project]\nname = "example"\nversion = "1.0.0"\n',
    'query.sql': 'SELECT 1;\n',
    'nginx.conf': 'events {}\nhttp {}\n',
    'source.swift': 'let answer = 42\n',
    'script.sh': '#!/usr/bin/env bash\nprintf "example\\n"\n',
    'src/index.ts': 'export const answer = 42;\n',
};

export const PLAIN_TOOL_FILES = [
    'trivy-findings.tpl',
    'no-gerunds-in-titles.tengo',
    '.editorconfig',
    'prettierignore',
    '.prettierignore',
    '.semgrepignore',
    'accept.txt',
    'shellcheckrc',
    'swiftformat',
    'trivyignore',
];
