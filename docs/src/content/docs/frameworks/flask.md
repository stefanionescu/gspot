---
title: Flask
configurations: [flask]
---

The `flask` configuration adds Semgrep rules for the routes and settings of a Flask application. gspot turns it on when
the project depends on `flask`.

## Semgrep rules

`security/semgrep` runs these rules on macOS and Linux before each push. The rules that follow request data report a
value that reaches the call within one function:

| Rule                                           | Reports                                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `gspot.flask.request-data-in-redirect`         | A `redirect` to a URL from the request.                                                                             |
| `gspot.flask.request-data-in-file-path`        | `open` or `send_file` with a path from the request, unless `secure_filename` or `os.path.basename` cleans it.       |
| `gspot.flask.request-data-in-outbound-request` | An outbound request, through `requests`, `httpx`, or `urlopen`, to a URL from the request.                          |
| `gspot.flask.request-data-in-template-source`  | `render_template_string` with template text that holds request data.                                                |
| `gspot.flask.request-data-in-html-response`    | A route or `make_response` that returns request data as HTML, unless `escape` escapes it.                           |
| `gspot.flask.insecure-setting`                 | `WTF_CSRF_ENABLED`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_HTTPONLY`, or `REMEMBER_COOKIE_SECURE` set to `False`. |

To accept a finding, ignore the rule with a reason:

```shell title="example"
gspot ignore security/semgrep --rule gspot.flask.insecure-setting --paths "tests/conftest.py" --reason "The test client posts forms without a CSRF token."
```

To add rules of your own, follow [Semgrep](/topics/security/#semgrep).
