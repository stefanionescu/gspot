export const CODEQL_LANGUAGE = 'python';
export const CODEQL_FILE = 'query.py';
export const CODEQL_SAMPLE =
    'from flask import request\nimport sqlite3\n\ndef query():\n    value = request.args.get("name")\n    sqlite3.connect("db.sqlite").execute("SELECT * FROM users WHERE name = " + value)\n';
export const CODEQL_CORRECTED =
    'from flask import request\nimport sqlite3\n\ndef query():\n    value = request.args.get("name")\n    sqlite3.connect("db.sqlite").execute("SELECT * FROM users WHERE name = ?", (value,))\n';
export const CODEQL_RULE = 'py/sql-injection';
export const CODEQL_LINE = 6;
export const CODEQL_COLUMN = 42;
