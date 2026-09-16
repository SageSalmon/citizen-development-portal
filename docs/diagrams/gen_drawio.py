"""Generate docs/diagrams/architecture.drawio (compressed draw.io XML) and architecture.uncompressed.drawio for import into Lucidchart
(More menu > File > Import > Import documents, or File > Import > draw.io). Also writes an
approximate SVG preview. Run: python3 docs/diagrams/gen_drawio.py"""
import html, pathlib, textwrap

OUT = pathlib.Path(__file__).resolve().parent
cells, edges = [], []
nid = [2]
def new_id():
    nid[0] += 1; return f"c{nid[0]}"

def box(x, y, w, h, title, sub="", fill="#FFFFFF", stroke="#2F3B52", dashed=False, sw=1.5,
        align="center", vAlign="middle", fontSize=12, titleOnly=False, parent="1"):
    id = new_id()
    label = f"<b>{html.escape(title)}</b>" + (f"<br>{html.escape(sub)}" if sub else "")
    style = (f"rounded=1;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};strokeWidth={sw};"
             f"align={align};verticalAlign={vAlign};fontSize={fontSize};spacing=6;fontColor=#1F2933;"
             + ("dashed=1;" if dashed else ""))
    cells.append((id, label, style, x, y, w, h, parent))
    return id

def lane(x, y, w, h, title, fill="#F4F6F8", stroke="#8A94A6"):
    id = new_id()
    style = (f"rounded=0;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};strokeWidth=1;"
             f"align=left;verticalAlign=top;fontSize=14;fontStyle=1;spacingLeft=10;spacingTop=6;fontColor=#3E4C59;")
    cells.append((id, html.escape(title), style, x, y, w, h, "1"))
    return id

def edge(src, dst, label="", dashed=False, color="#2F3B52", exitp=None, entryp=None):
    id = new_id()
    style = (f"edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;endFill=1;strokeWidth=1.5;"
             f"strokeColor={color};fontColor={color};fontSize=10;labelBackgroundColor=#FFFFFF;"
             + ("dashed=1;" if dashed else ""))
    if exitp:  style += f"exitX={exitp[0]};exitY={exitp[1]};"
    if entryp: style += f"entryX={entryp[0]};entryY={entryp[1]};"
    edges.append((id, html.escape(label), style, src, dst))

# palette
LANE, GATE, GATES = "#F4F6F8", "#E8F1FB", "#2B6CB0"
AZ, AZS = "#EEF7F0", "#2F855A"
ID, IDS = "#F3ECFA", "#6B46C1"
NOTE, NOTES = "#FFF4B8", "#B08900"
OPEN, OPENS = "#FDE2E2", "#B42318"

# title
tid = new_id()
cells.append((tid, "<b>Citizen app playground — architecture</b> &nbsp;·&nbsp; thin slice built, first deploy pending, 2026-09-16 &nbsp;·&nbsp; <i>the skill suggests; the infrastructure enforces</i> &nbsp;·&nbsp; dashed = planned",
              "rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=none;align=left;verticalAlign=middle;fontSize=16;fontColor=#1F2933;", 40, 20, 1200, 30, "1"))

# lanes
lane(40, 70, 440, 900, "DEVELOPER LAPTOP")
lane(520, 70, 460, 900, "GITHUB")
lane(1020, 70, 700, 900, "AZURE")
lane(1760, 70, 180, 900, "USERS")

# developer lane
skills = box(70, 120, 380, 80, "Claude Code + two skills", "new-citizen-app (build) · deploy-citizen-app (deploy)")
app    = box(70, 240, 380, 100, "App working copy — TypeScript + React on Functions", "app.yaml · host.json · web/ (Vite) · server/ (handlers) · one-line workflow")
check  = box(70, 380, 380, 70, "scripts/check.mjs — vendored copy of the gate rules", "npm run check · 7 rules · advisory, editable", fill=GATE, stroke=GATES)
gh     = box(70, 490, 380, 60, "Developer's gh login", "the only credential on the laptop · cannot reach Azure", fill=ID, stroke=IDS)
nSkill = box(70, 600, 380, 120, "KEY POINT — skill matches gates",
             "Same rules, two copies. The skill vendors infra/gates into every app as check.mjs. Gate 2 runs the platform's copy and reports if the two differ. Every rule bites at exactly one gate (05, rule-to-gate map). A rule without a gate is a gap, not a control.",
             fill=NOTE, stroke=NOTES, sw=2, align="left", fontSize=11)
nOpen  = box(70, 760, 380, 150, "DECIDED D32 — GitHub repo created at scaffold",
             "new-citizen-app runs git init + gh repo create in SageSalmon before any code exists (D31, D32, 2026-09-16), and sets the repo OIDC subject template. The alternative (create on first deploy) was considered and not chosen. gh signed in to the org is the one prerequisite.",
             fill=OPEN, stroke=OPENS, sw=2, align="left", fontSize=11)

# github lane
apprepo = box(550, 120, 400, 70, "App repo  <org>/<app-name>", "private · developer pushes main as themselves (D24) · workflow = one line")
plat    = box(550, 230, 400, 90, "Platform repo  citizen-development-portal", "infra/gates (authoritative) · reusable workflow · terraform · apps/<name>.tf · fabric publisher · policy · dashboard")
g1 = box(550, 370, 400, 80, "GATE 1 — ADMISSION (manual today)", "operator writes app-<name>.tf · terraform apply · infra/registry/<name>.json · owner/group/roles checks planned", fill=GATE, stroke=GATES, sw=2)
g2 = box(550, 490, 400, 90, "GATE 2 — BUILD  (job A: runs app code, NO token)", "lockfile · exact pins · release age · allow-list · audit · secret scan · host.json + healthz + signin · workflow call · vendored = platform", fill=GATE, stroke=GATES, sw=2)
g3 = box(550, 620, 400, 110, "GATE 3 — DEPLOY  (job B: OIDC token, runs NO app code)", "admitted? (registry) → az login OIDC → upload zip → anonymous /api/healthz must be refused (302/401). No rollback yet.", fill=GATE, stroke=GATES, sw=2)
nCred = box(550, 780, 400, 110, "KEY POINT — credential split (07)",
            "Job A runs the developer's code and holds no token. Job B holds a minutes-long OIDC token for one app and runs no app code. No long-lived secret exists in GitHub or on the laptop. The deploy identity cannot widen what an app may do; only Terraform can.",
            fill=NOTE, stroke=NOTES, sw=2, align="left", fontSize=11)

# azure lane
tf    = box(1050, 120, 300, 80, "Terraform apply", "platform identity · from platform repo main only · creates per-app infra, roles, auth config", dashed=True)
entra = box(1390, 120, 300, 80, "Entra ID", "built-in auth · access groups · per-app deploy + runtime identities · monitoring identity", fill=ID, stroke=IDS)
aca   = box(1050, 250, 400, 100, "Azure Functions, Flex Consumption (one app per plan)", "Node 24 handlers · scale to zero · Easy Auth in front, secretless (D33) · identity headers in · JSON logs out · 3 identities: runtime, auth, deploy", fill=AZ, stroke=AZS, sw=2)
acr   = box(1480, 250, 210, 45, "Storage (no keys)", "app package · MI access", fill=AZ, stroke=AZS)
kv    = box(1480, 305, 210, 45, "Key Vault (planned)", "secrets as references", fill=AZ, stroke=AZS, dashed=True)
pg    = box(1050, 400, 300, 80, "PostgreSQL (planned)", "db + role per app · migration identity DDL · app DML only", fill=AZ, stroke=AZS, dashed=True)
fab   = box(1390, 400, 300, 80, "Fabric workspace (planned)", "lakehouse · notebooks · pipelines · ML · platform checks runner", fill=AZ, stroke=AZS, dashed=True)
la    = box(1050, 530, 300, 70, "Log Analytics", "logs · sign-ins · heartbeats · gate + check results · cost", fill=AZ, stroke=AZS)
dash  = box(1390, 530, 300, 70, "Health dashboard (planned)", "platform tooling, not a playground app", fill=AZ, stroke=AZS, dashed=True)
g4    = box(1050, 650, 640, 80, "GATE 4 — RUNTIME (auth built; the rest planned)", "auth always on · tags · heartbeat 15 min · weekly dependency rescan · daily data checks · monthly owner + roles ceiling", fill=GATE, stroke=GATES, sw=2)
nData = box(1050, 780, 640, 110, "KEY POINT (planned) — two data targets, one deploy path (08, 09)",
            "Postgres and Fabric are both declared in data/, both applied by job B before the revision switch, both stop the deploy on failure. The app reads Postgres with a DML-only identity and Fabric as the signed-in user. Only platform identities change a schema or publish an item.",
            fill=NOTE, stroke=NOTES, sw=2, align="left", fontSize=11)

# users lane
users = box(1780, 120, 140, 80, "Citizen users", "Entra sign-in · access group · no anonymous path")

# edges
edge(skills, app, "scaffold, commit")
edge(app, check, "npm run check")
edge(app, apprepo, "git push main, as the developer", exitp=(1, 0.3), entryp=(0, 0.5))
edge(plat, check, "vendored copy", dashed=True, color=GATES, exitp=(0, 0.5), entryp=(1, 0.5))
edge(skills, g1, "admission PR", dashed=True, exitp=(1, 0.7), entryp=(0, 0.5))
edge(apprepo, g2, "one-line call", exitp=(0.9, 1), entryp=(0.9, 0))
edge(plat, g1, "", color=GATES)
edge(g1, g2, "", color=GATES)
edge(g2, g3, "image digest", color=GATES)
edge(g1, tf, "merge → apply", color=GATES, exitp=(1, 0.5), entryp=(0, 0.5))
edge(tf, aca, "provisions", dashed=True)
edge(tf, entra, "identities, roles", dashed=True, exitp=(1, 0.5), entryp=(0, 0.5))
edge(entra, g3, "OIDC, per app", dashed=True, color=IDS, exitp=(0, 0.8), entryp=(1, 0.2))
edge(g3, acr, "zip package", color=GATES, exitp=(1, 0.35), entryp=(0, 0.5))
edge(g3, aca, "config-zip deploy", color=GATES, exitp=(1, 0.5), entryp=(0, 0.7))
edge(g3, pg, "migrations (planned)", dashed=True, color=GATES, exitp=(1, 0.65), entryp=(0, 0.5))
edge(g3, fab, "items, checks (planned)", dashed=True, color=GATES, exitp=(1, 0.85), entryp=(0, 0.8))
edge(users, entra, "sign in", color=IDS, exitp=(0, 0.5), entryp=(1, 0.5))
edge(entra, aca, "authenticated only", color=IDS, exitp=(0.3, 1), entryp=(0.85, 0))
edge(aca, kv, "", exitp=(1, 0.75), entryp=(0, 0.5))
edge(aca, pg, "DML", exitp=(0.3, 1), entryp=(0.4, 0))
edge(aca, fab, "SQL endpoint, as user", exitp=(0.8, 1), entryp=(0.3, 0))
edge(pg, la, "", dashed=True)
edge(la, dash, "", exitp=(1, 0.5), entryp=(0, 0.5))
edge(g4, aca, "heartbeat", dashed=True, color=GATES, exitp=(0.1, 0), entryp=(0.1, 1))
edge(g4, fab, "daily checks", dashed=True, color=GATES, exitp=(0.9, 0), entryp=(0.9, 1))
edge(nSkill, check, "", dashed=True, color=NOTES)
edge(nSkill, g2, "", dashed=True, color=NOTES, exitp=(1, 0.3), entryp=(0, 0.6))
edge(nOpen, apprepo, "", dashed=True, color=OPENS, exitp=(1, 0.2), entryp=(0, 0.8))

# ---- draw.io XML ----
def cell_xml(id, label, style, x, y, w, h, parent):
    return (f'<mxCell id="{id}" value="{html.escape(label, quote=True)}" style="{style}" vertex="1" parent="{parent}">'
            f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
def edge_xml(id, label, style, src, dst):
    return (f'<mxCell id="{id}" value="{html.escape(label, quote=True)}" style="{style}" edge="1" parent="1" source="{src}" target="{dst}">'
            f'<mxGeometry relative="1" as="geometry"/></mxCell>')
import base64, zlib, urllib.parse
model = ('<mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1980" pageHeight="1000" math="0" shadow="0">'
         '<root><mxCell id="0"/><mxCell id="1" parent="0"/>'
         + "".join(cell_xml(*c) for c in cells) + "".join(edge_xml(*e) for e in edges)
         + '</root></mxGraphModel>')
head = '<mxfile host="app.diagrams.net" modified="2026-09-10T00:00:00.000Z" agent="draw.io" version="21.6.5" etag="gen" type="device" compressed="{c}">'
# classic draw.io encoding: base64( raw-deflate( encodeURIComponent(xml) ) )
enc = urllib.parse.quote(model, safe="~()*!.'")
co = zlib.compressobj(9, zlib.DEFLATED, -15); packed = co.compress(enc.encode()) + co.flush()
b64 = base64.b64encode(packed).decode()
(OUT / "architecture.drawio").write_text(head.format(c="true") + f'<diagram id="arch" name="Architecture">{b64}</diagram></mxfile>')
(OUT / "architecture.uncompressed.drawio").write_text(head.format(c="false") + f'<diagram id="arch" name="Architecture">{model}</diagram></mxfile>')
# round-trip check
assert urllib.parse.unquote(zlib.decompress(base64.b64decode(b64), -15).decode()) == model

# ---- approximate SVG preview ----
import re
S = {c[0]: c for c in cells}
def anchor(id, p):
    _, _, _, x, y, w, h, _ = S[id]; return x + p[0] * w, y + p[1] * h
def strip(s): return html.unescape(re.sub(r"<[^>]+>", "\n", s)).strip()
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1980" height="1980" viewBox="0 0 1980 1980" font-family="Helvetica, Arial" font-size="11">',
       '<defs><marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#2F3B52"/></marker></defs><rect width="1980" height="1980" fill="white"/>']
for id, label, style, x, y, w, h, _ in cells:
    fill = re.search(r"fillColor=(#\w+)", style); stroke = re.search(r"strokeColor=(#\w+)", style)
    if fill:
        dash = ' stroke-dasharray="6,4"' if "dashed=1" in style else ""
        svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="4" fill="{fill.group(1)}" stroke="{stroke.group(1)}"{dash}/>')
    lines_ = strip(label).split("\n"); ty = y + 16; cw = max(12, int(w / 6.0))
    for i, para in enumerate(lines_):
        for ln in textwrap.wrap(para, cw) or [""]:
            svg.append(f'<text x="{x+8}" y="{ty}"{" font-weight=\"bold\"" if i == 0 else ""}>{html.escape(ln)}</text>'); ty += 13
for id, label, style, src, dst in edges:
    ex = re.search(r"exitX=([\d.]+);exitY=([\d.]+)", style); en = re.search(r"entryX=([\d.]+);entryY=([\d.]+)", style)
    x1, y1 = anchor(src, (float(ex.group(1)), float(ex.group(2))) if ex else (0.5, 1))
    x2, y2 = anchor(dst, (float(en.group(1)), float(en.group(2))) if en else (0.5, 0))
    color = re.search(r"strokeColor=(#\w+)", style).group(1); dash = ' stroke-dasharray="6,4"' if "dashed=1" in style else ""
    svg.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="1.5"{dash} marker-end="url(#a)"/>')
    if label:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2; t = html.unescape(label)
        svg.append(f'<rect x="{mx-len(t)*2.7-3}" y="{my-9}" width="{len(t)*5.4+6}" height="13" fill="white" opacity="0.9"/><text x="{mx}" y="{my+1}" text-anchor="middle" font-size="10" fill="{color}">{html.escape(t)}</text>')
svg.append("</svg>")
(OUT / "architecture-preview.svg").write_text("\n".join(svg))
print("cells", len(cells), "edges", len(edges))
