import { describe, test } from 'bun:test';

import { SEMGREP_CHECK_ID, SEMGREP_SANDBOX } from '#tests/config/integration/semgrep.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';

const PYTHON_RULE_SOURCES = {
    django: `import os
from pathlib import Path

import requests
from django.http import FileResponse, HttpResponse, JsonResponse
from django.shortcuts import redirect
from django.utils.html import escape
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.csrf import csrf_exempt


def go(request):
    target = request.GET.get("next", "/")
    return redirect(target)


def go_safe(request):
    target = request.GET.get("next", "/")
    if url_has_allowed_host_and_scheme(target, allowed_hosts={"example.com"}):
        return redirect(target)
    return redirect("/")


def download(request):
    name = request.GET["file"]
    return FileResponse(open(os.path.join("/srv/files", name), "rb"))


def download_safe(request):
    name = os.path.basename(request.GET["file"])
    return FileResponse(open(os.path.join("/srv/files", name), "rb"))


def proxy(request):
    url = request.POST["url"]
    return JsonResponse({"status": requests.get(url, timeout=5).status_code})


def greet(request):
    name = request.GET.get("name", "")
    return HttpResponse(f"<p>Hello {name}</p>")


def greet_safe(request):
    name = escape(request.GET.get("name", ""))
    return HttpResponse(f"<p>Hello {name}</p>")


@csrf_exempt
def webhook(request):
    return HttpResponse("ok")
`,
    flask: `import os

import requests
from flask import Flask, jsonify, make_response, redirect, render_template_string, request, send_file, url_for
from markupsafe import escape

app = Flask(__name__)
app.config["WTF_CSRF_ENABLED"] = False
app.config["SESSION_COOKIE_SECURE"] = True


@app.route("/go")
def go():
    return redirect(request.args.get("next", "/"))


@app.route("/home")
def home():
    return redirect(url_for("index"))


@app.route("/file")
def file():
    return send_file(os.path.join("/srv/files", request.args["name"]))


@app.route("/file-safe")
def file_safe():
    return send_file(os.path.join("/srv/files", os.path.basename(request.args["name"])))


@app.route("/proxy", methods=["POST"])
def proxy():
    url = request.form["url"]
    return jsonify(status=requests.get(url, timeout=5).status_code)


@app.route("/hello")
def hello():
    name = request.args.get("name", "")
    return f"<p>Hello {name}</p>"


@app.route("/hello-safe")
def hello_safe():
    name = escape(request.args.get("name", ""))
    return f"<p>Hello {name}</p>"


@app.route("/hello-json")
def hello_json():
    return jsonify(name=request.args.get("name", ""))


@app.route("/page")
def page():
    return render_template_string("<p>" + request.args.get("text", "") + "</p>")


@app.route("/cookie")
def cookie():
    return make_response(request.cookies.get("theme", ""))
`,
    pyjwt: `import os

import jwt

KEY = os.environ["JWT_KEY"]
unsafe = jwt.decode(token, options={"verify_signature": False})
legacy = jwt.decode(token, verify=False)
forged = jwt.encode({"sub": "1"}, KEY, algorithm="none")
lenient = jwt.decode(token, KEY, algorithms=["HS256", "none"])
inline = jwt.encode({"sub": "1"}, "development-key", algorithm="HS256")
safe = jwt.decode(token, KEY, algorithms=["HS256"])
signed = jwt.encode({"sub": "1"}, KEY, algorithm="HS256")
`,
    'machine-learning': `import joblib
import numpy as np
import torch
from huggingface_hub import hf_hub_download, snapshot_download
from transformers import AutoModel

weights = torch.load("model.pt", weights_only=False)
safe_weights = torch.load("model.pt", weights_only=True)
arrays = np.load("arrays.npz", allow_pickle=True)
plain_arrays = np.load("arrays.npz")
remote = AutoModel.from_pretrained("org/model", trust_remote_code=True)
estimator = joblib.load("estimator.joblib")
floating = AutoModel.from_pretrained("org/model")
pinned = AutoModel.from_pretrained("org/model", revision="0123456789abcdef0123456789abcdef01234567")
folder = snapshot_download(repo_id="org/data")
pinned_folder = snapshot_download(repo_id="org/data", revision="0123456789abcdef0123456789abcdef01234567")
file = hf_hub_download("org/data", "train.csv")
local = AutoModel.from_pretrained("/models/local", local_files_only=True)
local_folder = snapshot_download(repo_id="org/data", local_files_only=True)
online = AutoModel.from_pretrained("org/model", local_files_only=False)
`,
} as const;

const CASES = [
    {
        configuration: 'django',
        level: 'all',
        dependency: 'django',
        files: { 'views.py': PYTHON_RULE_SOURCES.django, 'settings.py': 'SESSION_COOKIE_SECURE = False\n' },
        findings: [
            ['settings.py', 1, 'gspot.django.insecure-cookie-setting'],
            ['views.py', 14, 'gspot.django.request-data-in-redirect'],
            ['views.py', 26, 'gspot.django.request-data-in-file-path'],
            ['views.py', 36, 'gspot.django.request-data-in-outbound-request'],
            ['views.py', 41, 'gspot.django.request-data-in-html-response'],
            ['views.py', 49, 'gspot.django.csrf-exempt'],
        ],
    },
    {
        configuration: 'flask',
        level: 'all',
        dependency: 'flask',
        files: { 'app.py': PYTHON_RULE_SOURCES.flask },
        findings: [
            ['app.py', 8, 'gspot.flask.insecure-setting'],
            ['app.py', 14, 'gspot.flask.request-data-in-redirect'],
            ['app.py', 24, 'gspot.flask.request-data-in-file-path'],
            ['app.py', 35, 'gspot.flask.request-data-in-outbound-request'],
            ['app.py', 41, 'gspot.flask.request-data-in-html-response'],
            ['app.py', 57, 'gspot.flask.request-data-in-template-source'],
            ['app.py', 62, 'gspot.flask.request-data-in-html-response'],
        ],
    },
    {
        configuration: 'pyjwt',
        level: 'all',
        dependency: 'PyJWT',
        files: { 'tokens.py': PYTHON_RULE_SOURCES.pyjwt },
        findings: [
            ['tokens.py', 6, 'gspot.pyjwt.unverified-decode'],
            ['tokens.py', 7, 'gspot.pyjwt.unverified-decode'],
            ['tokens.py', 8, 'gspot.pyjwt.none-algorithm'],
            ['tokens.py', 9, 'gspot.pyjwt.none-algorithm'],
            ['tokens.py', 10, 'gspot.pyjwt.hardcoded-key'],
        ],
    },
    {
        configuration: 'machine-learning',
        level: 'all',
        dependency: 'torch',
        files: { 'model.py': PYTHON_RULE_SOURCES['machine-learning'] },
        findings: [
            ['model.py', 7, 'gspot.ml.unsafe-torch-load'],
            ['model.py', 9, 'gspot.ml.numpy-pickle-load'],
            ['model.py', 11, 'gspot.ml.trust-remote-code'],
            ['model.py', 11, 'gspot.ml.unpinned-hub-download'],
            ['model.py', 12, 'gspot.ml.joblib-load'],
            ['model.py', 13, 'gspot.ml.unpinned-hub-download'],
            ['model.py', 15, 'gspot.ml.unpinned-hub-download'],
            ['model.py', 17, 'gspot.ml.unpinned-hub-download'],
            ['model.py', 20, 'gspot.ml.unpinned-hub-download'],
        ],
    },
    {
        configuration: 'machine-learning',
        level: 'basic',
        dependency: 'torch',
        files: { 'model.py': PYTHON_RULE_SOURCES['machine-learning'] },
        findings: [
            ['model.py', 7, 'gspot.ml.unsafe-torch-load'],
            ['model.py', 9, 'gspot.ml.numpy-pickle-load'],
            ['model.py', 11, 'gspot.ml.trust-remote-code'],
        ],
    },
] as const;

describe.skipIf(!hasToolBuild('semgrep'))('semgrep', () => {
    const installedSandbox = shareInstalledSandbox(SEMGREP_SANDBOX);
    test.each([...CASES])(
        'the $configuration rules at level $level report each unsafe call and accept a module without one',
        async ({ configuration, level, dependency, files, findings }) => {
            const sourceFiles = {
                'gspot.toml': buildSandboxSettings([configuration, 'security'], { level }),
                'pyproject.toml': `[project]\nname = "example"\nversion = "1.0.0"\ndependencies = ["${dependency}"]\n`,
                ...files,
            };
            const expected = findings.map(([file, line, rule]) => ({ file, line, rule }));
            await assertCheckSample(installedSandbox(), {
                ...buildSandboxChanges(SEMGREP_SANDBOX.files, sourceFiles),
                check: SEMGREP_CHECK_ID,
                apply: true,
                expected: expected[0]!,
                findings: expected,
                corrected: {
                    files: {
                        ...sourceFiles,
                        ...Object.fromEntries(Object.keys(files).map((path) => [path, 'VALUE = 1\n'])),
                    },
                },
            });
        },
    );
});
