import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const chrome = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 19223;
const profile = "/tmp/proofready-smoke-profile";
const baseUrl = process.env.APP_URL || "http://127.0.0.1:4173";
let browser;

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForTarget() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const page = pages.find((item) => item.type === "page" && item.url.startsWith(baseUrl));
      if (page) return page;
    } catch {}
    await pause(250);
  }
  throw new Error("Chrome DevTools target did not become ready");
}

function cdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  const opened = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  return {
    opened,
    close: () => socket.close(),
    send(method, params = {}) {
      const requestId = ++id;
      return new Promise((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
        socket.send(JSON.stringify({ id: requestId, method, params }));
      });
    },
  };
}

try {
  await rm(profile, { recursive: true, force: true });
  browser = spawn(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--disable-background-networking",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--window-size=1440,1000",
    baseUrl,
  ], { stdio: "ignore" });

  const target = await waitForTarget();
  const client = cdp(target.webSocketDebuggerUrl);
  await client.opened;
  await client.send("Runtime.enable");
  await client.send("Page.enable");

  const initial = await client.send("Runtime.evaluate", {
    expression: `({ title: document.title, score: document.querySelector('#score-value')?.textContent })`,
    returnByValue: true,
  });
  assert.equal(initial.result.value.title, "ProofReady AI — AI literacy evidence pack");
  assert.equal(initial.result.value.score, "0");

  await client.send("Runtime.evaluate", {
    expression: `document.querySelector('#load-demo').click()`,
    returnByValue: true,
  });
  await pause(250);

  const demo = await client.send("Runtime.evaluate", {
    expression: `({
      score: document.querySelector('#score-value')?.textContent,
      tools: document.querySelector('#metric-tools')?.textContent,
      people: document.querySelector('#metric-people')?.textContent,
      policy: document.querySelector('#policy-preview')?.textContent,
      scoreLabel: document.querySelector('.score-card strong')?.textContent,
      caption: document.querySelector('#score-caption')?.textContent,
      saved: JSON.parse(localStorage.getItem('proofready-ai-v1')).company.name,
      savedToolRole: JSON.parse(localStorage.getItem('proofready-ai-v1')).tools[0].legalRole,
      savedExperience: JSON.parse(localStorage.getItem('proofready-ai-v1')).people[0].experience,
      savedEvidence: JSON.parse(localStorage.getItem('proofready-ai-v1')).people[0].evidenceReference
    })`,
    returnByValue: true,
  });
  assert.equal(demo.result.value.score, "90");
  assert.equal(demo.result.value.tools, "2");
  assert.equal(demo.result.value.people, "2");
  assert.match(demo.result.value.policy, /Northstar Studio/);
  assert.match(demo.result.value.policy, /does not determine or certify compliance/i);
  assert.equal(demo.result.value.scoreLabel, "Record completeness");
  assert.match(demo.result.value.caption, /Not a legal score/i);
  assert.equal(demo.result.value.saved, "Northstar Studio");
  assert.equal(demo.result.value.savedToolRole, "deployer");
  assert.equal(demo.result.value.savedExperience, "Basic");
  assert.equal(demo.result.value.savedEvidence, "Workshop plan v1");

  await mkdir(path.resolve("artifacts"), { recursive: true });
  const screenshot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  await writeFile(path.resolve("artifacts/proofready-demo.png"), Buffer.from(screenshot.data, "base64"));

  await client.send("Page.navigate", { url: `${baseUrl}/launch.html` });
  await pause(450);
  const landing = await client.send("Runtime.evaluate", {
    expression: `({
      title: document.title,
      headline: document.querySelector('h1')?.textContent,
      offers: document.querySelectorAll('.offers article').length,
      localLink: document.querySelector('a[href="index.html"]')?.href
    })`,
    returnByValue: true,
  });
  assert.equal(landing.result.value.title, "ProofReady AI — Organise your AI-literacy evidence");
  assert.match(landing.result.value.headline, /reviewable working file/i);
  assert.equal(landing.result.value.offers, 2);
  assert.match(landing.result.value.localLink, /index\.html$/);
  const landingShot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  await writeFile(path.resolve("artifacts/proofready-landing.png"), Buffer.from(landingShot.data, "base64"));

  await client.send("Page.navigate", { url: `${baseUrl}/validation/article4-checklist.html` });
  await pause(350);
  const checklist = await client.send("Runtime.evaluate", {
    expression: `({ title: document.title, items: document.querySelectorAll('.item').length, notice: document.querySelector('.notice')?.textContent })`,
    returnByValue: true,
  });
  assert.match(checklist.result.value.title, /AI Literacy Evidence Checklist/);
  assert.equal(checklist.result.value.items, 15);
  assert.match(checklist.result.value.notice, /not legal advice/i);

  client.close();
  console.log("Browser smoke passed: MVP workflow, persistence, landing page, founding offers, checklist, and screenshots.");
} finally {
  if (browser && !browser.killed) browser.kill("SIGKILL");
  await rm(profile, { recursive: true, force: true });
}
