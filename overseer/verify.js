#!/usr/bin/env node
/**
 * SynthOverseer verification runner.
 *
 * Reads tools/overseer/verify-cases.json, fires each prompt at the live server via
 * SynthRCON, tails the server log for the matching [pipeline #N] resolved line, then runs
 * each case's assertions on:
 *   - extracted assistant response content (from [llm #N] response body: JSON)
 *   - tool-registry trace lines
 *   - raw log substrings
 *
 * Prints colored pass/fail per case + summary; exits 0 if all pass, 1 otherwise.
 *
 * Usage:
 *   node tools/overseer/verify.js                     # run all cases
 *   node tools/overseer/verify.js --case A.player-info-provider   # one case
 *   node tools/overseer/verify.js --filter A.        # filter by id prefix
 *   node tools/overseer/verify.js --save overseer-test  # which save's log/rcon
 *   node tools/overseer/verify.js --rcon-port 25577     # override
 *   node tools/overseer/verify.js --logs-dir <path>     # override log directory
 *   node tools/overseer/verify.js --quiet               # only show failures
 *
 * Limitations (see overseer-verification-prompts.md):
 *   - Reads the server log, so depends on the [llm #N] / [pipeline #N] log format
 *     emitted by OpenAiClient + PromptPipeline. If those change, this script breaks.
 *   - Doesn't cover UI rendering (section D). Those need a different harness.
 *   - SynthRCON only sees the synchronous "thinking…" reply (per overseer-discoveries.md),
 *     so we poll the log for the async resolution.
 */

const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

// ---------- CLI ----------

function parseArgs(argv) {
  const args = {
    save: "overseer-test",
    rconHost: null,
    rconPort: null,
    logsDir: null,
    casesFile: path.join(__dirname, "verify-cases.json"),
    filter: null,
    onlyCase: null,
    quiet: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--save") args.save = next();
    else if (a === "--rcon-host") args.rconHost = next();
    else if (a === "--rcon-port") args.rconPort = parseInt(next(), 10);
    else if (a === "--logs-dir") args.logsDir = next();
    else if (a === "--cases") args.casesFile = next();
    else if (a === "--case") args.onlyCase = next();
    else if (a === "--filter") args.filter = next();
    else if (a === "--quiet") args.quiet = true;
    else if (a === "--help" || a === "-h") {
      console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(2, 25).join("\n"));
      process.exit(0);
    } else {
      console.error(`unknown arg: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

// ---------- save / log discovery ----------

function savePath(saveName) {
  if (path.isAbsolute(saveName) && fs.existsSync(saveName)) return saveName;
  const root = path.join(os.homedir(), "AppData", "Roaming", "Hytale", "UserData", "Saves", saveName);
  if (!fs.existsSync(root)) throw new Error(`save not found: ${root}`);
  return root;
}

function loadDevServerConfig(saveRoot) {
  const p = path.join(saveRoot, "dev-server.json");
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function findLatestLog(logsDir) {
  const files = fs.readdirSync(logsDir)
    .filter((f) => f.endsWith(".log"))
    .map((f) => ({ f, mtime: fs.statSync(path.join(logsDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (files.length === 0) throw new Error(`no .log files in ${logsDir}`);
  return path.join(logsDir, files[0].f);
}

// ---------- rcon ----------

function postCommand(host, port, command, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ command });
    const req = http.request(
      {
        host, port,
        path: "/command",
        method: "POST",
        headers: { "content-type": "application/json", "content-length": Buffer.byteLength(payload) },
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => { data += c; });
        res.on("end", () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            if (res.statusCode < 200 || res.statusCode >= 300) {
              reject(new Error(`rcon HTTP ${res.statusCode}: ${parsed.error || data}`));
              return;
            }
            resolve(parsed);
          } catch (e) {
            reject(new Error(`rcon expected JSON, got: ${data}`));
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("rcon request timeout")));
    req.on("error", reject);
    req.end(payload);
  });
}

// ---------- log tail ----------

async function waitForPipelineResolved(logPath, startOffset, callIdHint, timeoutMs) {
  // BUG FIX: accumulate across read iterations. The submit line + resolved line are often
  // in DIFFERENT 250ms polling windows; returning just the last buffer drops the submit line
  // (and its ctx-providers=N annotation) from the assertion's view.
  const deadline = Date.now() + timeoutMs;
  let lastSize = startOffset;
  let accumulated = "";
  while (Date.now() < deadline) {
    const stat = fs.statSync(logPath);
    if (stat.size > lastSize) {
      const fd = fs.openSync(logPath, "r");
      const buf = Buffer.alloc(stat.size - lastSize);
      fs.readSync(fd, buf, 0, buf.length, lastSize);
      fs.closeSync(fd);
      lastSize = stat.size;
      accumulated += buf.toString("utf8");
      if (/\[pipeline #\d+\] (resolved|failed)/.test(accumulated)) {
        return { text: accumulated, finalSize: lastSize };
      }
    }
    await sleep(250);
  }
  return { text: accumulated, finalSize: lastSize, timedOut: true };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------- log parsing ----------

/**
 * Extract assistant response content from the [llm #N] response body: line(s).
 *
 * BUG FIX: the body sometimes has a leading newline + multi-line JSON. The naive non-greedy
 * `\{[\s\S]*?\}` stops at the FIRST closing brace (inside nested objects), capturing only
 * a fragment. Strategy: locate each `response body:` marker, then read forward to the next
 * timestamp-prefixed log line (`\n[YYYY/MM/DD`), then trim back to the matching closing
 * brace via balanced-brace counting.
 */
function extractResponseContent(logChunk) {
  const marker = "] response body:";
  let lastContent = null;
  let searchFrom = 0;
  while (true) {
    const idx = logChunk.indexOf(marker, searchFrom);
    if (idx < 0) break;
    const afterMarker = idx + marker.length;
    // Skip whitespace (including newline) to find the opening `{`.
    let i = afterMarker;
    while (i < logChunk.length && /\s/.test(logChunk[i])) i++;
    if (logChunk[i] !== "{") { searchFrom = afterMarker; continue; }
    // Find the matching closing brace (naive — strings can contain braces, so track quoted state).
    let depth = 0;
    let inString = false;
    let escape = false;
    let end = -1;
    for (let j = i; j < logChunk.length; j++) {
      const c = logChunk[j];
      if (escape) { escape = false; continue; }
      if (c === "\\") { escape = true; continue; }
      if (c === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) { end = j + 1; break; }
      }
    }
    if (end < 0) break;
    const jsonText = logChunk.slice(i, end);
    try {
      const obj = JSON.parse(jsonText);
      const c = obj?.choices?.[0]?.message?.content;
      if (typeof c === "string") lastContent = c;
    } catch (_) { /* malformed — skip */ }
    searchFrom = end;
  }
  return lastContent;
}

/** Tool names that fired in this chunk. */
function extractToolCalls(logChunk) {
  const out = [];
  const re = /\[tool-registry\] (\S+) (ok|threw)/g;
  let m;
  while ((m = re.exec(logChunk)) !== null) {
    out.push({ name: m[1], status: m[2] });
  }
  return out;
}

// ---------- assertions ----------

function runAssertions(assertions, ctx) {
  const failures = [];
  for (const a of assertions) {
    const res = runOne(a, ctx);
    if (!res.pass) failures.push({ assertion: a, reason: res.reason });
  }
  return failures;
}

function runOne(a, { logChunk, response, toolCalls }) {
  switch (a.type) {
    case "log_contains":
      return logChunk.includes(a.value)
        ? { pass: true }
        : { pass: false, reason: `log did not contain "${a.value}"` };

    case "log_contains_all": {
      const missing = (a.values || []).filter((v) => !logChunk.includes(v));
      return missing.length === 0
        ? { pass: true }
        : { pass: false, reason: `log missing: ${missing.map((m) => `"${m}"`).join(", ")}` };
    }

    case "response_contains_any": {
      if (response == null) return { pass: false, reason: "no response captured (LLM call timed out or didn't run)" };
      const lower = response.toLowerCase();
      const hit = (a.values || []).find((v) => lower.includes(v.toLowerCase()));
      return hit
        ? { pass: true }
        : { pass: false, reason: `response matched none of: ${a.values.map((v) => `"${v}"`).join(", ")}` };
    }

    case "response_contains_all": {
      if (response == null) return { pass: false, reason: "no response captured" };
      const lower = response.toLowerCase();
      const missing = (a.values || []).filter((v) => !lower.includes(v.toLowerCase()));
      return missing.length === 0
        ? { pass: true }
        : { pass: false, reason: `response missing: ${missing.map((m) => `"${m}"`).join(", ")}` };
    }

    case "response_matches": {
      if (response == null) return { pass: false, reason: "no response captured" };
      const re = new RegExp(a.value, a.flags || "i");
      return re.test(response)
        ? { pass: true }
        : { pass: false, reason: `response did not match /${a.value}/${a.flags || "i"}` };
    }

    case "min_response_chars": {
      if (response == null) return { pass: false, reason: "no response captured" };
      return response.length >= a.value
        ? { pass: true }
        : { pass: false, reason: `response only ${response.length} chars (needed ${a.value})` };
    }

    case "tool_called": {
      const matched = toolCalls.find((c) => c.name === a.value && c.status === "ok");
      return matched
        ? { pass: true }
        : { pass: false, reason: `tool "${a.value}" not called (or did not return ok). Calls: ${JSON.stringify(toolCalls)}` };
    }

    case "no_tool_called":
      return toolCalls.length === 0
        ? { pass: true }
        : { pass: false, reason: `expected no tool calls, got: ${JSON.stringify(toolCalls)}` };

    default:
      return { pass: false, reason: `unknown assertion type "${a.type}"` };
  }
}

// ---------- output ----------

const C = {
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  gray:   (s) => `\x1b[90m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
};

// ---------- main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const saveRoot = savePath(args.save);
  const dev = loadDevServerConfig(saveRoot);
  const rconHost = args.rconHost || dev.rconHost || "127.0.0.1";
  const rconPort = args.rconPort || dev.rconPort || 25576;
  const logsDir = args.logsDir || path.join(saveRoot, "logs");

  console.log(C.gray(`save=${args.save}  rcon=${rconHost}:${rconPort}  logs=${logsDir}`));

  // Health-check rcon before doing anything.
  try {
    await new Promise((resolve, reject) => {
      const req = http.request({ host: rconHost, port: rconPort, path: "/health", method: "GET", timeout: 3000 },
        (res) => { res.resume(); res.on("end", () => resolve()); });
      req.on("error", reject);
      req.on("timeout", () => req.destroy(new Error("health timeout")));
      req.end();
    });
  } catch (e) {
    console.error(C.red(`SynthRCON not reachable at ${rconHost}:${rconPort} — ${e.message}`));
    console.error(C.gray("Start the server with: node tools/server/start-server.js --background"));
    process.exit(2);
  }

  const manifest = JSON.parse(fs.readFileSync(args.casesFile, "utf8"));
  const defaultTimeoutMs = (manifest.default_timeout_seconds || 20) * 1000;

  let cases = manifest.cases || [];
  if (args.onlyCase) cases = cases.filter((c) => c.id === args.onlyCase);
  if (args.filter) cases = cases.filter((c) => c.id.startsWith(args.filter));
  if (cases.length === 0) {
    console.error(C.yellow("no cases match filter"));
    process.exit(2);
  }

  console.log(C.bold(`\nRunning ${cases.length} case(s)\n`));

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const results = [];

  for (const c of cases) {
    // Requires-player cases test the real player-context flow (PlayerInfoProvider, future
    // InventoryProvider, etc.). RCON has no player ref attached; synthesizing one would mean
    // the LLM sees a different prompt than a real user would. Skip cleanly until Story 2.18
    // (test endpoint with live player UUID) lands.
    if (c.requires_player) {
      console.log(`  ${C.yellow("⊘")} ${c.id} ${C.gray("(skipped: requires connected player; verifier has none)")}`);
      skipped++;
      continue;
    }

    const logPath = findLatestLog(logsDir);
    const startOffset = fs.statSync(logPath).size;

    process.stdout.write(`  ${C.gray("→")} ${c.id} ... `);
    let response = null;
    let logChunk = "";
    let toolCalls = [];
    let timedOut = false;

    try {
      // SynthRCON /command expects the command WITHOUT a leading slash.
      await postCommand(rconHost, rconPort, `os ${c.prompt}`);
    } catch (e) {
      console.log(C.red("RCON FAIL"));
      console.log(C.gray(`     ${e.message}`));
      failed++;
      results.push({ id: c.id, pass: false, reason: `rcon: ${e.message}` });
      continue;
    }

    if (!c.skip_llm_wait) {
      const timeoutMs = (c.timeout_seconds || defaultTimeoutMs / 1000) * 1000;
      const result = await waitForPipelineResolved(logPath, startOffset, null, timeoutMs);
      logChunk = result.text;
      timedOut = !!result.timedOut;
      response = extractResponseContent(logChunk);
      toolCalls = extractToolCalls(logChunk);
    } else {
      await sleep(500);
      const stat = fs.statSync(logPath);
      const fd = fs.openSync(logPath, "r");
      const buf = Buffer.alloc(stat.size - startOffset);
      fs.readSync(fd, buf, 0, buf.length, startOffset);
      fs.closeSync(fd);
      logChunk = buf.toString("utf8");
    }

    const failures = runAssertions(c.assertions || [], { logChunk, response, toolCalls });

    if (failures.length === 0) {
      console.log(C.green("PASS"));
      passed++;
      results.push({ id: c.id, pass: true });
      if (!args.quiet && response) {
        console.log(C.gray(`     reply: ${response.replace(/\s+/g, " ").slice(0, 120)}${response.length > 120 ? "…" : ""}`));
      }
    } else {
      console.log(C.red(timedOut ? "FAIL (timeout)" : "FAIL"));
      for (const f of failures) {
        console.log(C.red(`     × ${f.reason}`));
      }
      if (response) {
        console.log(C.gray(`     reply: ${response.replace(/\s+/g, " ").slice(0, 200)}${response.length > 200 ? "…" : ""}`));
      }
      failed++;
      results.push({ id: c.id, pass: false, failures, response });
    }
  }

  const skipSuffix = skipped > 0 ? `, ${skipped} skipped` : "";
  console.log(C.bold(`\n${passed} passed, ${failed} failed${skipSuffix}.\n`));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(C.red(`fatal: ${e.message}`));
  console.error(e.stack);
  process.exit(2);
});
