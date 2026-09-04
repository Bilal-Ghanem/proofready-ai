export const RISK_WEIGHTS = {
  low: 1,
  medium: 2,
  high: 4,
};

export const TEMPLATE_METADATA = {
  version: "0.2",
  reviewedOn: "2026-09-04",
  sources: [
    "https://digital-strategy.ec.europa.eu/en/faqs/ai-literacy-questions-answers",
    "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689",
    "https://eur-lex.europa.eu/eli/reg/2026/1744/oj",
  ],
};

export function uid(prefix = "item") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeState(input = {}) {
  return {
    company: {
      name: input.company?.name?.trim() || "Your organization",
      sector: input.company?.sector?.trim() || "Not specified",
      owner: input.company?.owner?.trim() || "Not assigned",
      reviewDate: input.company?.reviewDate || "",
    },
    tools: Array.isArray(input.tools) ? input.tools : [],
    people: Array.isArray(input.people) ? input.people : [],
    controls: {
      policy: Boolean(input.controls?.policy),
      training: Boolean(input.controls?.training),
      incidentPath: Boolean(input.controls?.incidentPath),
      reviewCadence: Boolean(input.controls?.reviewCadence),
    },
  };
}

export function calculateReadiness(input) {
  const state = normalizeState(input);
  const controlsDone = Object.values(state.controls).filter(Boolean).length;
  const inventoryScore = state.tools.length ? 20 : 0;
  const systemRoleScore = state.tools.length && state.tools.every((tool) => tool.legalRole && tool.legalRole !== "unsure") ? 5 : 0;
  const ownerScore = state.company.owner !== "Not assigned" ? 10 : 0;
  const peopleScore = state.people.length ? 10 : 0;
  const contextScore = state.people.length && state.people.every((person) => person.experience) ? 5 : 0;
  const controlScore = controlsDone * 10;
  const reviewScore = state.company.reviewDate ? 10 : 0;
  const score = Math.min(100, inventoryScore + systemRoleScore + ownerScore + peopleScore + contextScore + controlScore + reviewScore);

  const gaps = [];
  if (!state.tools.length) gaps.push("Create an AI use-case inventory");
  else if (!systemRoleScore) gaps.push("Classify the organisation's provider/deployer role for each AI use");
  if (!state.people.length) gaps.push("Identify roles that use or oversee AI");
  else if (!contextScore) gaps.push("Record current AI knowledge or experience for each role");
  if (state.company.owner === "Not assigned") gaps.push("Assign an AI literacy owner");
  if (!state.controls.policy) gaps.push("Approve an acceptable-use policy");
  if (!state.controls.training) gaps.push("Deliver and record role-appropriate training");
  if (!state.controls.incidentPath) gaps.push("Document an AI incident/escalation path");
  if (!state.controls.reviewCadence) gaps.push("Set a recurring review cadence");
  if (!state.company.reviewDate) gaps.push("Schedule the next review date");

  return { score, gaps, controlsDone, controlsTotal: 4 };
}

export function calculateRiskSummary(tools = []) {
  return tools.reduce(
    (summary, tool) => {
      const level = RISK_WEIGHTS[tool.risk] ? tool.risk : "medium";
      summary[level] += 1;
      summary.weighted += RISK_WEIGHTS[level];
      if (tool.personalData) summary.personalData += 1;
      if (!tool.owner?.trim()) summary.unowned += 1;
      return summary;
    },
    { low: 0, medium: 0, high: 0, weighted: 0, personalData: 0, unowned: 0 },
  );
}

export function trainingModulesFor(person, tools = []) {
  const modules = new Set([
    "AI basics, limitations and confident-vs-correct behavior",
    "Organization acceptable-use rules and escalation path",
  ]);
  const role = (person.role || "").toLowerCase();
  const relevant = tools.filter((tool) => !person.toolIds?.length || person.toolIds.includes(tool.id));

  if (relevant.some((tool) => tool.personalData)) {
    modules.add("Personal-data, confidentiality and approved-input handling");
  }
  if (relevant.some((tool) => tool.risk === "high")) {
    modules.add("Enhanced human review for high-impact outputs");
  }
  if (/manager|owner|director|lead|founder|compliance/.test(role)) {
    modules.add("Management oversight, documentation and periodic review");
  }
  if (/marketing|content|sales|support|writer|design/.test(role)) {
    modules.add("Disclosure, intellectual-property and misleading-content checks");
  }
  if (/developer|engineer|data|technical|product/.test(role)) {
    modules.add("Testing, monitoring, security and failure-mode evaluation");
  }

  return [...modules];
}

export function buildActionPlan(input) {
  const state = normalizeState(input);
  const readiness = calculateReadiness(state);
  const actions = readiness.gaps.map((gap, index) => ({
    priority: index < 3 ? "Now" : "Next",
    action: gap,
    owner: state.company.owner,
  }));

  if (state.tools.some((tool) => tool.risk === "high")) {
    actions.unshift({
      priority: "Now",
      action: "Review high-impact AI uses and define mandatory human approval",
      owner: state.company.owner,
    });
  }
  if (state.tools.some((tool) => tool.personalData)) {
    actions.unshift({
      priority: "Now",
      action: "Confirm approved handling rules for personal or confidential data",
      owner: state.company.owner,
    });
  }
  return actions.slice(0, 8);
}

export function buildPolicy(input) {
  const state = normalizeState(input);
  const toolNames = state.tools.map((tool) => tool.name).filter(Boolean).join(", ") || "approved AI tools listed in the inventory";
  return `${state.company.name} — Responsible AI Use & Literacy Policy

Purpose
This policy helps our people use AI competently, responsibly and with appropriate human oversight. It is an operational starting point, not legal advice.

Scope
It applies to employees, contractors and managers who select, operate, supervise or rely on AI systems. Current inventoried tools include: ${toolNames}.

Rules
1. Use only approved AI tools for an authorized business purpose.
2. Do not enter personal, confidential, client or restricted information unless that use is expressly approved.
3. Check material AI outputs for accuracy, bias, security, intellectual-property and context risks before use.
4. A person remains accountable for decisions and deliverables supported by AI.
5. Escalate unexpected behavior, harmful output, data exposure or high-impact mistakes to ${state.company.owner}.
6. Complete role-appropriate AI literacy activity and retain a record of participation.
7. Apply stronger review where an AI use may affect rights, safety, access, employment, credit, health or other consequential outcomes.

Governance
Owner: ${state.company.owner}
Sector/context: ${state.company.sector}
Next review: ${state.company.reviewDate || "To be scheduled"}

Approved by: ____________________  Date: __________
Version: ${TEMPLATE_METADATA.version} generated by ProofReady AI
Template reviewed: ${TEMPLATE_METADATA.reviewedOn}
Operational aid only; this policy does not determine or certify compliance.`;
}

export function buildEvidencePack(input) {
  const state = normalizeState(input);
  const readiness = calculateReadiness(state);
  const risk = calculateRiskSummary(state.tools);
  const actions = buildActionPlan(state);

  return {
    generatedAt: new Date().toISOString(),
    organization: state.company,
    readiness,
    riskSummary: risk,
    inventory: state.tools,
    trainingMatrix: state.people.map((person) => ({
      name: person.name,
      role: person.role,
      experience: person.experience || "Not recorded",
      literacyAction: person.literacyAction || "Not recorded",
      status: person.status || "Planned",
      completedDate: person.completedDate || "",
      evidenceReference: person.evidenceReference || "",
      relevantToolIds: person.toolIds || [],
      modules: trainingModulesFor(person, state.tools),
    })),
    controls: state.controls,
    actionPlan: actions,
    policy: buildPolicy(state),
    template: TEMPLATE_METADATA,
    scoreMeaning: "Operational record completeness only; not a legal compliance score.",
    disclaimer: "Operational planning aid only. It does not determine or certify legal compliance and does not replace qualified legal advice.",
  };
}

export function demoState() {
  const writingId = "tool-writing";
  const supportId = "tool-support";
  return {
    company: {
      name: "Northstar Studio",
      sector: "Digital agency serving EU clients",
      owner: "Operations Lead",
      reviewDate: "2026-12-01",
    },
    tools: [
      {
        id: writingId,
        name: "AI writing assistant",
        purpose: "Draft campaign concepts and first-pass copy",
        owner: "Marketing Lead",
        risk: "medium",
        legalRole: "deployer",
        personalData: false,
        oversight: "Human editor checks claims, tone and rights before publication",
      },
      {
        id: supportId,
        name: "Support summarizer",
        purpose: "Summarize client support conversations",
        owner: "Client Services Lead",
        risk: "high",
        legalRole: "deployer",
        personalData: true,
        oversight: "Account owner validates summaries; no automated client decisions",
      },
    ],
    people: [
      { id: "person-1", name: "Agency team", role: "Marketing and client support", experience: "Basic", literacyAction: "Role briefing and safe-use workshop", status: "Planned", completedDate: "", evidenceReference: "Workshop plan v1", toolIds: [writingId, supportId] },
      { id: "person-2", name: "Team leads", role: "Manager and compliance owner", experience: "Working", literacyAction: "Oversight and escalation review", status: "In progress", completedDate: "", evidenceReference: "Operations agenda Q4", toolIds: [writingId, supportId] },
    ],
    controls: { policy: true, training: false, incidentPath: true, reviewCadence: true },
  };
}
