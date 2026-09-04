import {
  buildActionPlan,
  buildEvidencePack,
  buildPolicy,
  calculateReadiness,
  calculateRiskSummary,
  demoState,
  normalizeState,
  trainingModulesFor,
  uid,
} from "./core.js";

const STORAGE_KEY = "proofready-ai-v1";
const blankState = {
  company: { name: "", sector: "", owner: "", reviewDate: "" },
  tools: [],
  people: [],
  controls: { policy: false, training: false, incidentPath: false, reviewCadence: false },
};

let state = loadState();
let toastTimer;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function loadState() {
  try {
    return { ...blankState, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return structuredClone(blankState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const status = $("#save-status");
  status.textContent = "Saving…";
  window.setTimeout(() => (status.textContent = "Saved locally"), 350);
  render();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function setTab(tabName) {
  const titles = {
    overview: "Operational overview",
    inventory: "AI use inventory",
    people: "People & training",
    controls: "Program controls",
    evidence: "Evidence pack",
  };
  $$(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === tabName));
  $$(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.tab === tabName));
  $("#page-title").textContent = titles[tabName] || titles.overview;
  $(".sidebar").classList.remove("open");
  history.replaceState(null, "", `#${tabName}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderOverview() {
  const readiness = calculateReadiness(state);
  const risk = calculateRiskSummary(state.tools);
  $("#score-value").textContent = readiness.score;
  $("#score-ring").style.setProperty("--score-angle", `${readiness.score * 3.6}deg`);
  $("#score-caption").textContent = readiness.score >= 80 ? "Most core fields are filled; review gaps. Not a legal score." : readiness.score >= 50 ? "Core fields are taking shape. Not a legal score." : state.tools.length ? "Your working record has gaps. Not a legal score." : "Add an AI use to begin. Not a legal score.";
  $("#metric-tools").textContent = state.tools.length;
  $("#metric-people").textContent = state.people.length;
  $("#metric-risk").textContent = risk.high;
  $("#metric-controls").textContent = `${readiness.controlsDone}/4`;

  const actions = buildActionPlan(state);
  $("#action-list").innerHTML = actions.length
    ? actions.slice(0, 5).map((item, index) => `<div class="action-item"><span class="action-number">${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(item.action)}</strong><br><small>Owner: ${escapeHtml(item.owner)}</small></div><span class="priority">${escapeHtml(item.priority)}</span></div>`).join("")
    : '<div class="empty-state">Your core evidence is complete. Review it with the appropriate internal or legal owner.</div>';
}

function renderTools() {
  $("#tool-empty").hidden = state.tools.length > 0;
  $("#tool-list").innerHTML = state.tools.map((tool) => `
    <article class="item-card">
      <div>
        <h3>${escapeHtml(tool.name)}</h3>
        <p>${escapeHtml(tool.purpose)}</p>
        <div class="item-meta">
          <span class="tag ${escapeHtml(tool.risk)}">${escapeHtml(tool.risk)} impact</span>
          <span class="tag">Role: ${escapeHtml(tool.legalRole || "unsure")}</span>
          <span class="tag">Owner: ${escapeHtml(tool.owner || "Unassigned")}</span>
          ${tool.personalData ? '<span class="tag high">Personal/confidential data</span>' : '<span class="tag">No sensitive data recorded</span>'}
          ${tool.oversight ? `<span class="tag">Human oversight documented</span>` : '<span class="tag high">Oversight missing</span>'}
        </div>
      </div>
      <div class="item-actions"><button class="mini-button" data-edit-tool="${tool.id}">Edit</button><button class="mini-button" data-delete-tool="${tool.id}">Delete</button></div>
    </article>`).join("");
}

function renderPeople() {
  $("#people-empty").hidden = state.people.length > 0;
  $("#people-list").innerHTML = state.people.map((person) => {
    const modules = trainingModulesFor(person, state.tools);
    return `<article class="item-card">
      <div><h3>${escapeHtml(person.name)} <span class="tag ${person.status === "Complete" ? "complete" : ""}">${escapeHtml(person.status || "Planned")}</span></h3><p>${escapeHtml(person.role)}</p>
      <div class="item-meta"><span class="tag">Experience: ${escapeHtml(person.experience || "Not recorded")}</span><span class="tag">Action: ${escapeHtml(person.literacyAction || "Not recorded")}</span>${person.completedDate ? `<span class="tag complete">Completed: ${escapeHtml(person.completedDate)}</span>` : ""}${person.evidenceReference ? `<span class="tag">Evidence: ${escapeHtml(person.evidenceReference)}</span>` : '<span class="tag high">Evidence reference missing</span>'}</div>
      <ul class="module-list">${modules.map((module) => `<li>${escapeHtml(module)}</li>`).join("")}</ul></div>
      <div class="item-actions"><button class="mini-button" data-edit-person="${person.id}">Edit</button><button class="mini-button" data-delete-person="${person.id}">Delete</button></div>
    </article>`;
  }).join("");
}

function renderControls() {
  $("#company-name").value = state.company.name || "";
  $("#company-sector").value = state.company.sector || "";
  $("#company-owner").value = state.company.owner || "";
  $("#review-date").value = state.company.reviewDate || "";
  $$('[data-control]').forEach((input) => (input.checked = Boolean(state.controls[input.dataset.control])));
}

function renderEvidence() {
  $("#policy-preview").textContent = buildPolicy(state);
}

function render() {
  renderOverview();
  renderTools();
  renderPeople();
  renderControls();
  renderEvidence();
}

function openToolDialog(tool = {}) {
  const form = $("#tool-form");
  form.reset();
  form.elements.id.value = tool.id || "";
  form.elements.name.value = tool.name || "";
  form.elements.owner.value = tool.owner || "";
  form.elements.purpose.value = tool.purpose || "";
  form.elements.risk.value = tool.risk || "medium";
  form.elements.legalRole.value = tool.legalRole || "unsure";
  form.elements.personalData.checked = Boolean(tool.personalData);
  form.elements.oversight.value = tool.oversight || "";
  $("#tool-dialog").showModal();
}

function saveTool(event) {
  event.preventDefault();
  const form = $("#tool-form");
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const tool = {
    id: data.get("id") || uid("tool"),
    name: data.get("name").trim(),
    owner: data.get("owner").trim(),
    purpose: data.get("purpose").trim(),
    risk: data.get("risk"),
    legalRole: data.get("legalRole"),
    personalData: data.get("personalData") === "on",
    oversight: data.get("oversight").trim(),
  };
  const index = state.tools.findIndex((item) => item.id === tool.id);
  if (index >= 0) state.tools[index] = tool;
  else state.tools.push(tool);
  $("#tool-dialog").close();
  saveState();
  showToast(index >= 0 ? "AI use updated" : "AI use added");
}

function personToolOptions(selectedIds = []) {
  return state.tools.length
    ? state.tools.map((tool) => `<label><input type="checkbox" name="toolIds" value="${tool.id}" ${selectedIds.includes(tool.id) ? "checked" : ""}> ${escapeHtml(tool.name)}</label>`).join("")
    : '<p class="empty-state">No AI uses exist yet. This role will receive general literacy modules.</p>';
}

function openPersonDialog(person = {}) {
  const form = $("#person-form");
  form.reset();
  form.elements.id.value = person.id || "";
  form.elements.name.value = person.name || "";
  form.elements.role.value = person.role || "";
  form.elements.experience.value = person.experience || "";
  form.elements.literacyAction.value = person.literacyAction || "";
  form.elements.status.value = person.status || "Planned";
  form.elements.completedDate.value = person.completedDate || "";
  form.elements.evidenceReference.value = person.evidenceReference || "";
  $("#person-tool-options").innerHTML = personToolOptions(person.toolIds || []);
  $("#person-dialog").showModal();
}

function savePerson(event) {
  event.preventDefault();
  const form = $("#person-form");
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const person = {
    id: data.get("id") || uid("person"),
    name: data.get("name").trim(),
    role: data.get("role").trim(),
    experience: data.get("experience"),
    literacyAction: data.get("literacyAction").trim(),
    status: data.get("status"),
    completedDate: data.get("completedDate"),
    evidenceReference: data.get("evidenceReference").trim(),
    toolIds: data.getAll("toolIds"),
  };
  const index = state.people.findIndex((item) => item.id === person.id);
  if (index >= 0) state.people[index] = person;
  else state.people.push(person);
  $("#person-dialog").close();
  saveState();
  showToast(index >= 0 ? "Role updated" : "Role added");
}

function downloadPack() {
  const pack = buildEvidencePack(state);
  const slug = (state.company.name || "organization").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${slug || "organization"}-ai-literacy-evidence.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Evidence pack exported");
}

async function copyPolicy() {
  await navigator.clipboard.writeText(buildPolicy(state));
  showToast("Policy copied to clipboard");
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-tab]");
  if (nav) { event.preventDefault(); setTab(nav.dataset.tab); return; }
  const go = event.target.closest("[data-go]");
  if (go) { setTab(go.dataset.go); return; }
  if (event.target.closest('[data-action="add-tool"]')) openToolDialog();
  if (event.target.closest('[data-action="add-person"]')) openPersonDialog();

  const editTool = event.target.closest("[data-edit-tool]");
  if (editTool) openToolDialog(state.tools.find((tool) => tool.id === editTool.dataset.editTool));
  const deleteTool = event.target.closest("[data-delete-tool]");
  if (deleteTool && confirm("Delete this AI use from the inventory?")) {
    state.tools = state.tools.filter((tool) => tool.id !== deleteTool.dataset.deleteTool);
    state.people = state.people.map((person) => ({ ...person, toolIds: (person.toolIds || []).filter((id) => id !== deleteTool.dataset.deleteTool) }));
    saveState();
  }
  const editPerson = event.target.closest("[data-edit-person]");
  if (editPerson) openPersonDialog(state.people.find((person) => person.id === editPerson.dataset.editPerson));
  const deletePerson = event.target.closest("[data-delete-person]");
  if (deletePerson && confirm("Delete this person or role?")) {
    state.people = state.people.filter((person) => person.id !== deletePerson.dataset.deletePerson);
    saveState();
  }
});

$("#add-tool").addEventListener("click", () => openToolDialog());
$("#add-person").addEventListener("click", () => openPersonDialog());
$("#save-tool").addEventListener("click", saveTool);
$("#save-person").addEventListener("click", savePerson);
$("#export-pack").addEventListener("click", downloadPack);
$("#print-pack").addEventListener("click", () => window.print());
$("#copy-policy").addEventListener("click", () => copyPolicy().catch(() => showToast("Clipboard access was blocked")));
$("#load-demo").addEventListener("click", () => {
  state = demoState();
  saveState();
  showToast("Example workspace loaded");
});
$(".mobile-menu").addEventListener("click", () => $(".sidebar").classList.toggle("open"));

$$('#controls input[type="text"], #controls input[type="date"]').forEach((input) => input.addEventListener("change", () => {
  state.company = {
    name: $("#company-name").value,
    sector: $("#company-sector").value,
    owner: $("#company-owner").value,
    reviewDate: $("#review-date").value,
  };
  saveState();
}));
$$('[data-control]').forEach((input) => input.addEventListener("change", () => {
  state.controls[input.dataset.control] = input.checked;
  saveState();
}));

render();
setTab(location.hash.slice(1) || "overview");
