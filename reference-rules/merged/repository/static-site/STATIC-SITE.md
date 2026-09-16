# Static Sites

## Templates and Browser Assets

Templates under `pages/` and root HTML files should stay declarative.

Rules:

- Do not add executable inline scripts to templates.
- JSON-LD is allowed with `<script type="application/ld+json">` because it is data, not executable app logic.
- Do not use `document.write`.
- Do not use inline event handler attributes.
- Do not use `javascript:` URLs.
- Put browser behavior in separate script files.
- Prefer safe DOM mutation: `textContent`, attributes, class changes, and created nodes.
- Avoid `innerHTML`, `outerHTML`, and `insertAdjacentHTML` unless a reviewed static, trusted markup path is the real contract.
- Keep visible copy in config/content/pages as appropriate; do not hide user copy in build-script template literals.

Browser scripts should be defensive at DOM boundaries without swallowing real programming errors. Check that required elements exist before binding behavior.
