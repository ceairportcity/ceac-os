import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { projectCreatorLabel, projectCreatedAtLabel } from "../src/lib/projectAttribution.js";

test("project attribution identifies the recorded creator, not lead department or assigned owner", () => {
  const project = { created_by: "user-a", creator_display_name: "  Project Author  ", delivery_owner_id: "user-b" };
  assert.equal(projectCreatorLabel(project, { id: "user-b", full_name: "Delivery Owner" }), "Project Author");
  assert.equal(projectCreatorLabel({ created_by: "user-a", creator_display_name: null }, { id: "user-b", full_name: "Delivery Owner" }), "Name unavailable");
  assert.equal(projectCreatorLabel({ created_by: "user-a", creator_display_name: null }, { id: "user-a", full_name: "Project Author" }), "Project Author");
  assert.equal(projectCreatorLabel({ created_by: null }), "Not recorded");
});

test("project creation time is shown in Ghana time, without changing the stored timestamp", () => {
  assert.match(projectCreatedAtLabel("2026-11-03T15:50:13.019Z"), /3 Nov 2026.*3:50.*GMT/i);
  assert.equal(projectCreatedAtLabel("not-a-date"), "Not recorded");
});

test("project lists and detail views request the stored creator name", () => {
  for (const path of ["src/screens/AdminProjects.jsx", "src/screens/ManagerProjects.jsx", "src/components/Stage2ProjectReader.jsx", "src/components/AssignedProjects.jsx", "src/screens/Delivery.jsx"]) {
    const source = readFileSync(new URL("../" + path, import.meta.url), "utf8");
    assert.match(source, /creator_display_name/, path);
    assert.match(source, /created_by,\s*created_at/, path);
  }
  const admin = readFileSync(new URL("../src/screens/AdminProjects.jsx", import.meta.url), "utf8");
  const manager = readFileSync(new URL("../src/screens/ManagerProjects.jsx", import.meta.url), "utf8");
  const overview = readFileSync(new URL("../src/components/Stage2ProjectOverview.jsx", import.meta.url), "utf8");
  assert.match(admin, /Created by \$\{projectCreatorLabel/);
  assert.match(manager, /<span>Created by<\/span>/);
  assert.match(overview, /<dt>Created by<\/dt>/);
});
