---
title: Django
configurations: [django]
---

The `django` configuration adds Semgrep rules for the views and settings of a Django project. gspot turns it on when the
project depends on `django`.

## Semgrep rules

`security/semgrep` runs these rules on macOS and Linux before each push. The rules that follow request data report a
value that reaches the call within one function:

| Rule                                            | Reports                                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `gspot.django.request-data-in-redirect`         | A redirect to a URL from the request, unless `url_has_allowed_host_and_scheme` checks it first. |
| `gspot.django.request-data-in-file-path`        | A file opened by a path from the request, unless `os.path.basename` keeps only the name.        |
| `gspot.django.request-data-in-outbound-request` | An outbound request, through `requests`, `httpx`, or `urlopen`, to a URL from the request.      |
| `gspot.django.request-data-in-html-response`    | An `HttpResponse` whose content holds request data that `escape` did not escape.                |
| `gspot.django.csrf-exempt`                      | A view with `@csrf_exempt`.                                                                     |
| `gspot.django.insecure-cookie-setting`          | `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, or `SESSION_COOKIE_HTTPONLY` set to `False`.     |

To accept a finding, ignore the rule with a reason:

```shell title="example"
gspot ignore security/semgrep --rule gspot.django.csrf-exempt --paths "payments/webhooks.py" --reason "The payment provider signs each webhook, and the view checks the signature."
```

To add rules of your own, follow [Semgrep](/topics/security/#semgrep).
