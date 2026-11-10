import { BASE_INSTALLED_FILES } from '#tests/config/integration/commands.ts';

export const FASTAPI_PROJECT = `[project]
name = "example"
version = "1.0.0"
dependencies = ["fastapi"]
`;

export const SEMGREP_CHECK_ID = 'security/semgrep';

export const SEMGREP_CHECK = ['check', '--only', SEMGREP_CHECK_ID, '--json'] as const;

export const SEMGREP_SANDBOX = {
    configurations: ['typescript', 'python', 'bash', 'security', 'fastapi'],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;

export const FASTAPI_SCOPE_SETTINGS = `[[scope]]
path = "app"
configurations = ["fastapi"]

[[scope]]
path = "app/child"

[[scope]]
path = "sibling"
`;

export const FASTAPI_SOURCE = `from fastapi import HTTPException

def lookup():
    try:
        return load_user()
    except ValueError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
`;

export const FASTAPI_CONFIGURATION_CASES = [
    {
        rule: 'cors-wildcard-with-credentials',
        source: 'app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True)\n',
        fixed: 'app.add_middleware(CORSMiddleware, allow_origins=["https://example.test"], allow_credentials=True)\n',
    },
    { rule: 'debug-enabled', source: 'app = FastAPI(debug=True)\n', fixed: 'app = FastAPI(debug=False)\n' },
] as const;

export const REPOSITORY_RULE = `rules:
    - id: test-no-double
      pattern: double(...)
      message: The test rule of the repository fires here.
      languages: [typescript]
      severity: ERROR
`;

export const REPOSITORY_BASH_RULE = `rules:
    - id: test-no-eval
      pattern: eval ...
      message: The test rule of the repository fires here.
      languages: [bash]
      severity: ERROR
`;

export const MALFORMED_SEMGREP_RESULTS = [
    {
        check: 'security/semgrep',
        status: 'failed',
        findings: [{ file: 'scripts/café build.sh', line: 1, column: 1, rule: 'parse-error' }],
    },
] as const;

export const PYTHON_RULE_SOURCES = {
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
`,
} as const;
