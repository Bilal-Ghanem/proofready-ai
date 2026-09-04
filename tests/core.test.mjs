import test from "node:test";
import assert from "node:assert/strict";
import {
  buildActionPlan,
  buildEvidencePack,
  buildPolicy,
  calculateReadiness,
  calculateRiskSummary,
  demoState,
  trainingModulesFor,
} from "../core.js";

test("blank workspace has zero readiness and useful gaps", () => {
  const result = calculateReadiness({});
  assert.equal(result.score, 0);
  assert.ok(result.gaps.includes("Create an AI use-case inventory"));
  assert.equal(result.controlsDone, 0);
});

test("demo workspace produces a bounded, meaningful score", () => {
  const result = calculateReadiness(demoState());
  assert.equal(result.score, 90);
  assert.deepEqual(result.gaps, ["Deliver and record role-appropriate training"]);
});

test("risk summary handles invalid levels and sensitive data", () => {
  const result = calculateRiskSummary([
    { risk: "high", personalData: true, owner: "A" },
    { risk: "unknown", personalData: false, owner: "" },
  ]);
  assert.deepEqual(result, { low: 0, medium: 1, high: 1, weighted: 6, personalData: 1, unowned: 1 });
});

test("training suggestions respond to role and use context", () => {
  const modules = trainingModulesFor(
    { role: "Engineering manager", toolIds: ["a"] },
    [{ id: "a", risk: "high", personalData: true }],
  );
  assert.ok(modules.some((module) => module.includes("Personal-data")));
  assert.ok(modules.some((module) => module.includes("high-impact")));
  assert.ok(modules.some((module) => module.includes("Management")));
  assert.ok(modules.some((module) => module.includes("Testing")));
});

test("action plan raises sensitive and high-impact reviews first", () => {
  const actions = buildActionPlan(demoState());
  assert.match(actions[0].action, /personal or confidential data/i);
  assert.match(actions[1].action, /high-impact AI uses/i);
});

test("evidence pack contains inventory, training matrix, policy and disclaimer", () => {
  const pack = buildEvidencePack(demoState());
  assert.equal(pack.inventory.length, 2);
  assert.equal(pack.trainingMatrix.length, 2);
  assert.equal(pack.trainingMatrix[0].experience, "Basic");
  assert.equal(pack.trainingMatrix[0].evidenceReference, "Workshop plan v1");
  assert.equal(pack.template.version, "0.2");
  assert.match(pack.scoreMeaning, /not a legal compliance score/i);
  assert.match(pack.policy, /Northstar Studio/);
  assert.match(pack.disclaimer, /does not determine or certify legal compliance/i);
});

test("classification and experience gaps are explicit", () => {
  const state = demoState();
  delete state.tools[0].legalRole;
  delete state.people[0].experience;
  const result = calculateReadiness(state);
  assert.equal(result.score, 80);
  assert.ok(result.gaps.some((gap) => gap.includes("provider/deployer")));
  assert.ok(result.gaps.some((gap) => gap.includes("knowledge or experience")));
});

test("policy safely fills missing organization details", () => {
  const policy = buildPolicy({});
  assert.match(policy, /Your organization/);
  assert.match(policy, /Not assigned/);
  assert.match(policy, /does not determine or certify compliance/i);
});
