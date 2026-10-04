export const PYTHON_QUERY = {
    language: 'python',
    file: 'query.py',
    unsafe: 'from flask import request\nimport sqlite3\n\ndef query():\n    value = request.args.get("name")\n    sqlite3.connect("db.sqlite").execute("SELECT * FROM users WHERE name = " + value)\n',
    corrected:
        'from flask import request\nimport sqlite3\n\ndef query():\n    value = request.args.get("name")\n    sqlite3.connect("db.sqlite").execute("SELECT * FROM users WHERE name = ?", (value,))\n',
    rule: 'py/sql-injection',
    line: 6,
    column: 42,
};
