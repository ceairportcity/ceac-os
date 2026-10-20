import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/screens/Work.jsx", "utf8");

test("Staff work can link to authorised unit project, objective, and phase", () => {
  assert.match(source, /setObjectives\(objectiveRead\.data \|\| \[\]\)/);
  assert.match(source, /setPhases\(phaseRead\.data \|\| \[\]\)/);
  assert.match(source, /\.eq\("project_id", projectId\)\.eq\("unit_id", me\.unit_id\)/);
  assert.match(source, /verifiedProjectId === projectId/);
  assert.match(source, /p_project_id: linkedProjectId/);
  assert.match(source, /p_objective_id: linkedObjectiveId/);
  assert.match(source, /p_phase_id: linkedPhaseId/);
  assert.match(source, /Project objective and phase \(optional\)/);
});

test("Private work cannot attach an organisational project, objective, or phase", () => {
  assert.match(source, /const linkedProjectId = createVisibility === "unit" \? projectId \|\| null : null/);
  assert.match(source, /const linkedObjectiveId = linkedProjectId && objectiveId \? objectiveId : null/);
  assert.match(source, /const linkedPhaseId = linkedProjectId && phaseId \? phaseId : null/);
  assert.match(source, /createVisibility === "unit" && <FieldGroup label="Linked project \(optional\)">/);
});

test("Failed project context reads prevent a save and duplicate uncertain retries", () => {
  assert.match(source, /setVerifiedProjectId\(""\)/);
  assert.match(source, /projectContextLoading \|\| projectContextError \|\| verifiedProjectId !== projectId/);
  assert.match(source, /!projects\.some\(project => project\.id === projectId\)/);
  assert.match(source, /confirmation\.data\.project_id \|\| null/);
  assert.match(source, /confirmation\.data\.objective_id \|\| null/);
  assert.match(source, /confirmation\.data\.phase_id \|\| null/);
  assert.match(source, /ownCreatePending\.current/);
});

test("Staff project selector searches authorised projects and retains the selected project", () => {
  assert.match(source, /aria-label="Search authorised projects"/);
  assert.match(source, /project\.id === projectId \|\| project\.name\.toLowerCase\(\)\.includes\(projectQuery\.trim\(\)\.toLowerCase\(\)\)/);
  assert.match(source, /setProjectId\(""\); setProjectQuery\(""\)/);
  assert.match(source, /createVisibility === "unit" && <FieldGroup label="Linked project/);
});
