import json, zipfile, html, textwrap, pathlib

OUT = pathlib.Path("/Users/bill.doss/code/citizen-development-portal/docs/diagrams")
SCR = pathlib.Path("/private/tmp/claude-502/-Users-bill-doss-code-citizen-development-portal/a792d5d8-68cf-4b79-8cbd-b5a00be5cc34/scratchpad")

shapes, lines = [], []
C = dict(lane="#F4F6F8", laneStroke="#8A94A6", box="#FFFFFF", boxStroke="#2F3B52",
         gate="#E8F1FB", gateStroke="#2B6CB0", azure="#EEF7F0", note="#FFF4B8", noteStroke="#B08900",
         open_="#FDE2E2", openStroke="#B42318", ident="#F3ECFA", identStroke="#6B46C1")

def box(id, x, y, w, h, text, fill=C["box"], stroke=C["boxStroke"], type="rectangle", width=1.5, dashed=False, bold=False):
    shapes.append({"id": id, "type": type, "boundingBox": {"x": x, "y": y, "w": w, "h": h},
        "style": {"fill": {"type": "color", "color": fill},
                  "stroke": {"color": stroke, "width": width, "style": "dashed" if dashed else "solid"}},
        "text": text})
    return id

def line(id, a, b, text=None, ap=(0.5, 1), bp=(0.5, 0), dashed=False, color="#2F3B52", ltype="elbow"):
    l = {"id": id, "lineType": ltype,
         "endpoint1": {"type": "shapeEndpoint", "style": "none", "shapeId": a, "position": {"x": ap[0], "y": ap[1]}},
         "endpoint2": {"type": "shapeEndpoint", "style": "arrow", "shapeId": b, "position": {"x": bp[0], "y": bp[1]}},
         "stroke": {"color": color, "width": 1.5, "style": "dashed" if dashed else "solid"}}
    if text: l["text"] = [{"text": text, "position": 0.5, "side": "middle"}]
    lines.append(l)

# ---- Title ----
box("title", 40, 20, 2220, 50, "Citizen app playground — architecture (design only, 2026-09-10). Skill suggests; infrastructure enforces.", fill="#FFFFFF", stroke="#FFFFFF", width=0)

# ---- Lanes ----
box("laneDev", 40, 90, 520, 1120, "DEVELOPER LAPTOP\n(no Azure identity, no Docker required)", fill=C["lane"], stroke=C["laneStroke"])
box("laneGh",  600, 90, 560, 1120, "GITHUB  (<org>)", fill=C["lane"], stroke=C["laneStroke"])
box("laneUsers", 2040, 90, 220, 1120, "USERS", fill=C["lane"], stroke=C["laneStroke"])
box("laneAz",  1200, 90, 800, 1120, "AZURE  (platform subscription, Entra tenant)", fill=C["lane"], stroke=C["laneStroke"])

# ---- Developer lane ----
box("claude", 70, 170, 460, 130,
    "Claude Code + the two skills\n• citizen-app-new-custom — build: scaffold a conforming project, create its GitHub repo\n• citizen-app-deploy-custom — deploy: push, open admission PR, translate gate results\nSkills are advisory; everything they generate is editable.")
box("appdir", 70, 330, 460, 190,
    "App working copy (TypeScript + React, Node LTS)\napp.yaml — name, owner, maintainers, area, access.group, identity mode\nweb/  — React, built by Vite; never sees a secret\nserver/ — Hono: /healthz, /me, user.signin log, OBO calls\ndata/ — config.yaml, schema.ts, migrations/ (Postgres)\n           fabric/items/, fabric/checks/ (Fabric, 09)\nDockerfile — non-root, HEALTHCHECK\n.github/workflows — ONE LINE: calls the platform's reusable workflow")
box("check", 70, 550, 460, 110,
    "scripts/check.mjs  (vendored copy of infra/gates)\nnpm run check — same rules, same messages, seconds not minutes.\nAdvisory: the developer can edit it; the platform copy wins.",
    fill=C["gate"], stroke=C["gateStroke"])
box("ghlogin", 70, 690, 460, 80,
    "Developer's own gh login (OS keyring)\nThe only credential on the laptop. Cannot reach Azure.",
    fill=C["ident"], stroke=C["identStroke"])
box("fabricpull", 70, 800, 460, 90,
    "Pull from workspace (Fabric apps only)\nDevice-code sign-in as the developer → export item definitions\ninto data/fabric/items/. Workspace→repo is always the developer.",
    dashed=True)
box("users", 2060, 170, 180, 140,
    "Citizen users\nSign in with Entra; must be in the app's access group.\nNo public app, no anonymous path.",
    type="rectangle")

# ---- GitHub lane ----
box("apprepo", 630, 210, 500, 100,
    "App repo  <org>/<app-name>  (private)\nCreated by citizen-app-new-custom. Developer pushes to main as themselves (D24).\nWorkflow = one line calling the reusable workflow below.")
box("platrepo", 630, 340, 500, 220,
    "Platform repo  citizen-development-portal  (crown jewel: CODEOWNERS, no direct push, pinned Actions)\n"
    "infra/gates/ — the rule engine, Node built-ins only, AUTHORITATIVE copy\n"
    "infra/workflows/build-and-deploy.yml — the reusable workflow (Gates 2+3)\n"
    "infra/terraform/ — environment, dns, modules/app, modules/postgres, modules/fabric\n"
    "infra/apps/<name>.tf — one per admitted app, generated from app.yaml\n"
    "infra/fabric/publish.mjs + runner.Notebook — Fabric publisher and checks runner\n"
    "infra/policy/, infra/dashboard/")
box("gate1", 630, 590, 500, 120,
    "GATE 1 — ADMISSION  (PR to platform repo, human merge)\nowner & maintainers real Entra users · access.group exists · classification ≠ regulated\nidentity.roles ⊆ owner's roles · no never-grantable role · dedicated DB needs reason\nFabric shortcuts point only at data the owner can read",
    fill=C["gate"], stroke=C["gateStroke"], width=2)
box("gate2", 630, 750, 500, 150,
    "GATE 2 — BUILD  (reusable workflow, job A: NO TOKEN, runs app code)\nlockfile · exact pins · ignore-scripts · min release age (7d) · dep budget + allow-list\nnpm audit · secret scan · Dockerfile non-root · image scan · vendored check == platform check\nmigrations lint (08) · Fabric items + checks lint (09)\nBuilds for everyone; deploys only if pusher is owner/maintainer (D15)",
    fill=C["gate"], stroke=C["gateStroke"], width=2)
box("gate3", 630, 920, 500, 190,
    "GATE 3 — DEPLOY  (same workflow, job B: HOLDS OIDC TOKEN, never runs app code)\nOIDC JWT → per-app deploy identity (federated on repo + job_workflow_ref)\n1. Postgres migrations (migration identity, DDL, transactions)\n2. Publish checks runner + data/fabric/items to the app's workspace\n3. Run checks marked deploy — a block failure stops here\n4. Push image digest → ACR; update container app → new revision\n5. /healthz must answer 200 or traffic stays on the old revision",
    fill=C["gate"], stroke=C["gateStroke"], width=2)

# ---- Azure lane ----
box("entra", 1620, 170, 350, 140,
    "Entra ID\n• Built-in auth for every app (requireAuthentication)\n• App access groups (owner-controlled)\n• Platform monitoring identity (Viewer everywhere)\n• Per-app deploy identity + federated credential\n• Per-app runtime managed identity (nothing by default)",
    fill=C["ident"], stroke=C["identStroke"])
box("tf", 1230, 170, 360, 140,
    "Terraform (platform identity, OIDC, only from platform repo main)\nProvisions per admitted app: container app + auth config, MI + verified roles, Key Vault access, tags, budget alert, Postgres db + DML role, Fabric workspace + role assignments.\nDeploy identity cannot change any of this.",
    dashed=True)
box("aca", 1230, 350, 500, 170,
    "Container Apps environment   https://<app>.citizenappjhc.com  (one wildcard cert, DNS zone)\n"
    "┌ App container (one per app, scale-to-zero) ───────────────────┐\n"
    "│ Node LTS · $PORT · reads env + Key Vault refs · logs JSON to stdout │\n"
    "│ Identity headers from built-in auth (X-MS-CLIENT-PRINCIPAL-*)      │\n"
    "│ Runtime MI: own secrets + DML on own DB (+ declared roles ⊆ owner) │\n"
    "└────────────────────────────────────────────────────────────────┘",
    fill=C["azure"], stroke="#2F855A", width=2)
box("acr", 1760, 350, 210, 80, "Container Registry\nimage by commit + SBOM + scan results", fill=C["azure"], stroke="#2F855A")
box("kv", 1760, 450, 210, 70, "Key Vault\nsecrets as refs, resolved at start", fill=C["azure"], stroke="#2F855A")
box("pg", 1230, 560, 360, 120,
    "PostgreSQL Flexible Server (shared; dedicated on reason)\nOne database + one role per app · Entra auth, no passwords\nMigration identity: DDL · App runtime identity: DML only\nLocal dev: PGlite (same dialect)",
    fill=C["azure"], stroke="#2F855A")
box("fabric", 1620, 560, 350, 120,
    "Fabric workspace, one per app (shared capacity)\nLakehouse · Environment · Notebook · DataPipeline · MLExperiment/MLModel\nPlatform checks runner (overwritten every deploy)\nOwner=Admin · deploy identity=Contributor · app reads SQL endpoint as the user",
    fill=C["azure"], stroke="#2F855A")
box("la", 1230, 720, 360, 100,
    "Log Analytics\nstdout logs · user.signin events · heartbeats · gate results\n(app, gate, rule, pass/fail, commit, deployed-by UPN) · cost export by tag\nFabric publish + check results",
    fill=C["azure"], stroke="#2F855A")
box("dash", 1620, 720, 350, 100,
    "Health dashboard (Azure Monitor Workbook, D13)\nPLATFORM TOOLING — not a playground app; reader roles across the fleet\nFleet view · app view · gate feed · data checks · who used it",
    fill=C["azure"], stroke="#2F855A")
box("gate4", 1230, 860, 740, 130,
    "GATE 4 — RUNTIME  (Terraform-held config, Azure Policy, scheduled workflows in the platform repo)\n"
    "Ingress always authenticated · images from platform registry only · required tags · resource bounds\n"
    "Heartbeat every 15 min as monitoring identity (3 misses = down) · weekly image rescan · daily Fabric checks\n"
    "Monthly: owner still enabled; app roles and shortcuts still ⊆ owner · traffic-vs-signin signal · cert expiry watch",
    fill=C["gate"], stroke=C["gateStroke"], width=2)

# ---- Annotations ----
box("noteSkill", 70, 920, 460, 100,
    "KEY POINT — skill ↔ gates match\nOne rule implementation, two owners. The skill vendors infra/gates into every app as scripts/check.mjs; Gate 2 runs the authoritative copy from the platform repo and reports if the two disagree. Every rule in check bites at exactly one gate (05, rule-to-gate map). A rule with a skill tick and no gate is a gap, not a control.",
    fill=C["note"], stroke=C["noteStroke"], width=2)
box("noteOpen", 630, 140, 500, 50,
    "OPEN QUESTION — GitHub repo first, or created as part of the first push?",
    fill=C["open_"], stroke=C["openStroke"], width=2)
box("noteOpen2", 70, 1050, 460, 140,
    "OPEN QUESTION, detail (red box, GitHub lane) — Today 03-skills has citizen-app-new-custom run git init + gh repo create at scaffold time, so the repo exists before any code is written (GitHub first). Alternative: citizen-app-deploy-custom creates the repo on the first deploy (as part of push), so scaffolding needs no gh login and the admission PR and repo appear together. Affects the prerequisite check, D19 (how skills reach developers), D20 (repo settings), and when Gate 1 can start. Not yet recorded as open in 04-decisions.",
    fill=C["open_"], stroke=C["openStroke"], width=2)
box("noteCred", 630, 1130, 500, 70,
    "KEY POINT — credential split (07). Job A runs the developer's code and holds no token. Job B holds a minutes-long OIDC token and runs no app code. The laptop holds only a gh login. No long-lived secret exists anywhere in GitHub or on the laptop; the deploy identity cannot widen what the app may do — only Terraform can.",
    fill=C["note"], stroke=C["noteStroke"], width=2)

box("noteData", 1230, 1020, 740, 90,
    "KEY POINT — two data targets, one deploy path (08, 09). Postgres and Fabric are both declared in data/, both applied by job B before the revision switch, both stop the deploy on failure. The app's runtime identity is DML-only on its own database and reads Fabric as the signed-in user; only the platform's identities can change a schema or publish an item.",
    fill=C["note"], stroke=C["noteStroke"], width=2)

# ---- Lines ----
line("l1",  "claude",   "appdir",  "scaffold, commit")
line("l2",  "appdir",   "check",   "npm run check")
line("l3",  "appdir",   "apprepo", "git push main, as the developer", ap=(1, 0.2), bp=(0, 0.5))
line("l4",  "platrepo", "check",   "vendored copy of infra/gates", ap=(0, 0.3), bp=(1, 0.5), dashed=True, color="#2B6CB0")
line("l5",  "apprepo",  "gate2",   "one-line workflow calls reusable workflow", ap=(0.9, 1), bp=(0.9, 0))
line("l6",  "platrepo", "gate2",   "authoritative rules + workflow", ap=(0.5, 1), bp=(0.5, 0), color="#2B6CB0")
line("l7",  "claude",   "gate1",   "deploy skill opens admission PR (infra/apps/<name>.tf)", ap=(1, 0.8), bp=(0, 0.5), dashed=True)
line("l8",  "gate1",    "tf",      "merge → terraform apply", ap=(1, 0.5), bp=(0, 0.5), color="#2B6CB0")
line("l9",  "gate2",    "gate3",   "image digest as artifact")
line("l11", "gate3",    "acr",     "push image", ap=(1, 0.5), bp=(0.5, 1), color="#2B6CB0")
line("l12", "gate3",    "aca",     "update container app → revision", ap=(1, 0.3), bp=(0, 0.9), color="#2B6CB0")
line("l13", "gate3",    "pg",      "1. migrations", ap=(1, 0.6), bp=(0, 0.5), color="#2B6CB0")
line("l14", "gate3",    "fabric",  "2–3. publish items, run deploy checks", ap=(1, 0.8), bp=(0, 0.8), color="#2B6CB0")
line("l15", "users",    "entra",   "sign in → app URL", ap=(0, 0.5), bp=(1, 0.5), color="#6B46C1")
line("l16", "entra",    "aca",     "authenticated requests only; identity headers", ap=(0.3, 1), bp=(0.8, 0), color="#6B46C1")
line("l17", "aca",      "kv",      "secret refs", ap=(1, 0.6), bp=(0, 0.5))
line("l18", "aca",      "pg",      "DML as runtime MI", ap=(0.3, 1), bp=(0.3, 0))
line("l19", "aca",      "fabric",  "SQL endpoint, as the signed-in user", ap=(0.8, 1), bp=(0.3, 0))
line("l20", "aca",      "la",      "stdout JSON, user.signin", ap=(0.1, 1), bp=(0.1, 0))
line("l21", "la",       "dash",    "queries", ap=(1, 0.5), bp=(0, 0.5))
line("l22", "gate4",    "aca",     "heartbeat 15 min", ap=(0.15, 0), bp=(0.5, 1), dashed=True, color="#2B6CB0")
line("l23", "gate4",    "fabric",  "daily checks", ap=(0.8, 0), bp=(0.8, 1), dashed=True, color="#2B6CB0")
line("l24", "gate4",    "la",      "results", ap=(0.4, 0), bp=(0.6, 1), dashed=True, color="#2B6CB0")
line("l26", "tf",       "aca",     "provisions", ap=(0.3, 1), bp=(0.2, 0), dashed=True)
line("l27", "noteSkill", "check",  None, ap=(0.5, 0), bp=(0.5, 1), dashed=True, color="#B08900")
line("l28", "noteSkill", "gate2",  None, ap=(1, 0.5), bp=(0, 0.5), dashed=True, color="#B08900")
line("l29", "noteOpen",  "apprepo", None, ap=(0.5, 1), bp=(0.5, 0), dashed=True, color="#B42318")
line("l30", "noteOpen",  "claude",  None, ap=(0, 0.5), bp=(1, 0.3), dashed=True, color="#B42318")

doc = {"version": 1, "pages": [{"id": "page1", "title": "Citizen app playground — architecture", "shapes": shapes, "lines": lines}]}

# integrity
ids = [s["id"] for s in shapes]; assert len(ids) == len(set(ids))
for l in lines:
    for ep in ("endpoint1", "endpoint2"): assert l[ep]["shapeId"] in ids, l["id"]
lids = [l["id"] for l in lines]; assert len(lids) == len(set(lids))

(OUT / "architecture.lucid.json").write_text(json.dumps(doc, indent=2, ensure_ascii=False))
with zipfile.ZipFile(OUT / "architecture.lucid", "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("document.json", json.dumps(doc, ensure_ascii=False))

# ---- SVG preview (approximate: straight lines, wrapped text) ----
S = {s["id"]: s for s in shapes}
def anchor(sid, pos):
    b = S[sid]["boundingBox"]; return b["x"] + pos["x"] * b["w"], b["y"] + pos["y"] * b["h"]
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="2300" height="2300" viewBox="0 0 2300 2300" font-family="Helvetica, Arial" font-size="11">',
       '<defs><marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#2F3B52"/></marker></defs>',
       '<rect width="2300" height="2300" fill="white"/>']
for s in shapes:
    b = s["boundingBox"]; st = s["style"]
    dash = ' stroke-dasharray="6,4"' if st["stroke"]["style"] == "dashed" else ""
    svg.append(f'<rect x="{b["x"]}" y="{b["y"]}" width="{b["w"]}" height="{b["h"]}" fill="{st["fill"]["color"]}" stroke="{st["stroke"]["color"]}" stroke-width="{st["stroke"]["width"]}"{dash} rx="4"/>')
    is_lane = s["id"].startswith("lane")
    y = b["y"] + (14 if is_lane else 15)
    cw = max(10, int(b["w"] / 6.1))
    for i, para in enumerate(s["text"].split("\n")):
        for ln in (textwrap.wrap(para, cw) or [""]):
            weight = ' font-weight="bold"' if (i == 0 and not is_lane) or is_lane else ""
            svg.append(f'<text x="{b["x"]+8}" y="{y}"{weight}>{html.escape(ln)}</text>'); y += 13
        if is_lane: break
for l in lines:
    x1, y1 = anchor(l["endpoint1"]["shapeId"], l["endpoint1"]["position"]); x2, y2 = anchor(l["endpoint2"]["shapeId"], l["endpoint2"]["position"])
    dash = ' stroke-dasharray="6,4"' if l["stroke"]["style"] == "dashed" else ""
    svg.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{l["stroke"]["color"]}" stroke-width="1.5"{dash} marker-end="url(#a)"/>')
    if l.get("text"):
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2; t = html.escape(l["text"][0]["text"])
        svg.append(f'<rect x="{mx - len(t)*2.7 - 3}" y="{my - 9}" width="{len(t)*5.4 + 6}" height="13" fill="white" opacity="0.9"/><text x="{mx}" y="{my+1}" text-anchor="middle" font-size="10" fill="{l["stroke"]["color"]}">{t}</text>')
svg.append("</svg>")
(SCR / "preview.svg").write_text("\n".join(svg))
print("shapes", len(shapes), "lines", len(lines))
