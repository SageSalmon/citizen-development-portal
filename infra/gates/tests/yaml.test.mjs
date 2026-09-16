import { test } from "node:test";
import assert from "node:assert/strict";
import { parseYaml } from "../lib/yaml.mjs";

test("parses the app.yaml shape", () => {
  const y = parseYaml(`
# comment
name: expense-tracker
owner: someone@example.org     # trailing comment
maintainers: []
area: finance
description: "One line: with a colon"
access:
  group: app-expense-tracker-users
data:
  classification: internal
identity:
  mode: app
  roles:
    - role: Reader
      scope: /subscriptions/x/resourceGroups/y
  delegated_scopes: [Sites.Read.All, User.Read]
runtime:
  node: 24
env:
  LOG_LEVEL: info
github:
  deployers:
    - Wise-Fishy
`);
  assert.equal(y.name, "expense-tracker");
  assert.equal(y.owner, "someone@example.org");
  assert.deepEqual(y.maintainers, []);
  assert.equal(y.description, "One line: with a colon");
  assert.equal(y.access.group, "app-expense-tracker-users");
  assert.deepEqual(y.identity.roles, [{ role: "Reader", scope: "/subscriptions/x/resourceGroups/y" }]);
  assert.deepEqual(y.identity.delegated_scopes, ["Sites.Read.All", "User.Read"]);
  assert.equal(y.runtime.node, 24);
  assert.deepEqual(y.github.deployers, ["Wise-Fishy"]);
});

test("rejects tabs, anchors, multi-doc", () => {
  assert.throws(() => parseYaml("a:\n\tb: 1"), /tabs/);
  assert.throws(() => parseYaml("a: &x 1"), /anchors/);
  assert.throws(() => parseYaml("---\na: 1"), /multi-document/);
});
