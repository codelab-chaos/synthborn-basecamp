#!/usr/bin/env node
// Build, deploy, and verify the SynthOverseer jar. Wraps `./gradlew deploy` with a
// clear status banner + a `--verify` mode that reads the most recent `*_server.log`
// in the target save and prints the SynthOverseer setup line, so you can confirm
// the new jar is the one actually running.
//
// Usage:
//   node tools/overseer/redeploy.js            # build + deploy (local or remote per remote-host.env)
//   node tools/overseer/redeploy.js --restart  # stop server, build + deploy, start, verify
//   node tools/overseer/redeploy.js --verify   # show tool registry of running session
//   node tools/overseer/redeploy.js --local    # one-shot local (ignore HYTALE_REMOTE_ENABLED)
//   node tools/overseer/redeploy.js --remote   # one-shot remote
//
// Toggle default target in mods/SynthOverseer/remote-host.env:
//   HYTALE_REMOTE_ENABLED=true   # Mac host via scp + ssh
//   HYTALE_REMOTE_ENABLED=false  # Windows %APPDATA% gradle deploy

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const {
    configureRemoteHost,
    parseRemoteFlags,
    stripRemoteFlags,
    isRemoteEnabled,
    deployModLocal,
    deployModRemote,
    localSaveDir,
    remoteStopServer,
    remoteStartServer,
    remoteOverseerSetupLine,
    printModeBanner,
} = require('../library/remote-host');

const argv = stripRemoteFlags(process.argv.slice(2));
configureRemoteHost(parseRemoteFlags(process.argv.slice(2)));

const { modDir } = require('../library/workspace');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MOD_DIR = modDir('SynthOverseer');
const SAVE_NAME = 'overseer-test';
const SAVE_DIR = localSaveDir(SAVE_NAME);
const LOGS_DIR = path.join(SAVE_DIR, 'logs');

function dim(s) { return `\x1b[2m${s}\x1b[0m`; }
function bold(s) { return `\x1b[1m${s}\x1b[0m`; }
function green(s) { return `\x1b[32m${s}\x1b[0m`; }
function red(s) { return `\x1b[31m${s}\x1b[0m`; }
function yellow(s) { return `\x1b[33m${s}\x1b[0m`; }

function deploy() {
    if (!fs.existsSync(path.join(MOD_DIR, 'gradlew.bat')) &&
        !fs.existsSync(path.join(MOD_DIR, 'gradlew'))) {
        console.error(red('✗') + ` gradlew not found in ${MOD_DIR}`);
        process.exit(1);
    }

    printModeBanner('redeploy');
    console.log(bold('→ building + deploying SynthOverseer'));

    if (isRemoteEnabled()) {
        console.log(dim(`  cwd: ${MOD_DIR}`));
        console.log(dim(`  target: ${process.env.HYTALE_REMOTE_SAVES}/${SAVE_NAME}/mods/`));
        deployModRemote({
            modDir: MOD_DIR,
            saveName: SAVE_NAME,
            extraRemotePaths: [
                { local: 'overseer-config.example.json', remote: 'synthoverseer/overseer-config.example.json' },
                { local: 'overseer-config.json', remote: 'synthoverseer/overseer-config.json' },
            ],
        });
    } else {
        console.log(dim(`  cwd: ${MOD_DIR}`));
        console.log(dim(`  target: ${SAVE_DIR}/mods/`));
        deployModLocal(MOD_DIR, 'deploy');
    }

    console.log();
    console.log(green('✓ deployed'));
    console.log();
    if (isRemoteEnabled()) {
        console.log(bold('Next: restart the remote server if it is already running.'));
        console.log(dim('  node tools/overseer/redeploy.js --restart --remote'));
    } else {
        console.log(bold('Next: restart your Hytale world to load the new jar.'));
        console.log(dim('  (SynthOverseer runs in the Hytale client; only a fresh world session reloads the plugin.)'));
        console.log();
        console.log(dim('After restart, verify the tool registry with:'));
        console.log('  node tools/overseer/redeploy.js --verify');
    }
}

function parseToolsFromSetupLine(line) {
    const match = line.match(/SynthOverseer setup complete \(([^)]+)\)/);
    if (!match) return null;
    const toolsMatch = match[1].match(/tools=\[([^\]]+)\]/);
    if (!toolsMatch) return null;
    return toolsMatch[1].split(',').map(s => s.trim().replace(/[+-]$/, ''));
}

function printToolRegistry(tools) {
    console.log();
    console.log(green('✓') + ` SynthOverseer loaded with ${tools.length} tools`);
    console.log();
    for (const t of tools) {
        console.log('  ' + t);
    }

    const expected = [
        'scan_terrain', 'propose_village', 'materialize_village', 'route_path',
        'save_prefab', 'list_saved_prefabs', 'rate_prefab',
        'propose_building', 'materialize_building', 'revise_spec',
        'list_block_roles',
        'remember', 'recall', 'list_memories', 'update_memory', 'forget',
        'lookup_recipe', 'bench_recipes', 'craftable_from_inventory',
        'get_time', 'set_time', 'get_weather', 'teleport_player',
        'undo_last_n_placements',
        'highlight_volume', 'list_highlights', 'clear_highlight',
        'lidar_sphere',
    ];
    const missing = expected.filter(e => !tools.includes(e));
    console.log();
    if (missing.length > 0) {
        console.log(yellow('⚠') + ' expected-but-missing tools:');
        for (const m of missing) console.log('  ' + m);
        console.log();
        console.log(dim('  if you JUST deployed and the new tools are missing, the world wasn\'t restarted.'));
        process.exit(2);
    }
    console.log(green('all expected village/creator tools present'));
}

function verify() {
    printModeBanner('redeploy');

    if (isRemoteEnabled()) {
        console.log(dim('reading: remote overseer-test latest log'));
        const line = remoteOverseerSetupLine();
        console.log(dim(`  ${line}`));
        const tools = parseToolsFromSetupLine(line);
        if (!tools) {
            console.error(red('✗') + ' setup line found but no tools=[...] segment');
            process.exit(1);
        }
        printToolRegistry(tools);
        return;
    }

    if (!fs.existsSync(LOGS_DIR)) {
        console.error(red('✗') + ` no logs directory at ${LOGS_DIR}`);
        console.error(dim('  has the save been opened in Hytale at least once?'));
        process.exit(1);
    }
    const logs = fs.readdirSync(LOGS_DIR)
        .filter(f => f.endsWith('_server.log'))
        .map(f => ({ name: f, mtime: fs.statSync(path.join(LOGS_DIR, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);
    if (logs.length === 0) {
        console.error(red('✗') + ' no *_server.log files found');
        process.exit(1);
    }
    const latest = path.join(LOGS_DIR, logs[0].name);
    console.log(dim(`reading: ${latest}`));

    const text = fs.readFileSync(latest, 'utf8');
    const re = /\[SynthOverseer\|P\] SynthOverseer setup complete \(([^)]+)\)/g;
    const matches = [...text.matchAll(re)];
    if (matches.length === 0) {
        console.error(red('✗') + ' no SynthOverseer setup line in latest log');
        console.error(dim('  the plugin may not have loaded, or the log is stale'));
        process.exit(1);
    }
    const inner = matches[matches.length - 1][1];
    const toolsMatch = inner.match(/tools=\[([^\]]+)\]/);
    if (!toolsMatch) {
        console.error(red('✗') + ' setup line found but no tools=[...] segment');
        console.error(dim(`  raw: ${inner}`));
        process.exit(1);
    }
    printToolRegistry(toolsMatch[1].split(',').map(s => s.trim().replace(/[+-]$/, '')));
}

function runNode(scriptPath, args, opts = {}) {
    return spawnSync(process.execPath, [scriptPath, ...args], {
        stdio: opts.silent ? 'pipe' : 'inherit',
        cwd: REPO_ROOT,
        env: process.env,
    });
}

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function tryVerifyOnce() {
    const verifyArgs = ['--verify'];
    if (isRemoteEnabled()) verifyArgs.push('--remote');
    else verifyArgs.push('--local');
    const res = runNode(path.join(REPO_ROOT, 'tools', 'overseer', 'redeploy.js'), verifyArgs, { silent: true });
    return { code: res.status, out: res.stdout?.toString() || '', err: res.stderr?.toString() || '' };
}

async function restart() {
    printModeBanner('redeploy');

    if (isRemoteEnabled()) {
        console.log(bold('→ stopping remote server (if any)'));
        try {
            remoteStopServer(SAVE_NAME, { tolerateDown: true, force: true });
        } catch (err) {
            console.log(yellow('⚠') + ` remote stop — ${err.message}`);
        }
        console.log();
        deploy();
        console.log();
        console.log(bold('→ starting remote server'));
        const startRes = (() => {
            try {
                remoteStartServer(SAVE_NAME);
                return 0;
            } catch (err) {
                console.error(red('✗ remote start failed') + ` — ${err.message}`);
                return 1;
            }
        })();
        if (startRes !== 0) process.exit(1);
        console.log();
        console.log(bold('→ waiting for SynthOverseer setup line on remote host'));
    } else {
        const stopScript = path.join(REPO_ROOT, 'tools', 'server', 'stop-server.js');
        const startScript = path.join(REPO_ROOT, 'tools', 'server', 'start-server.js');

        console.log(bold('→ stopping running server (if any)'));
        const stopRes = runNode(stopScript, ['--save', SAVE_NAME, '--local']);
        if (stopRes.status !== 0) {
            console.log(yellow('⚠') + ' stop returned non-zero — proceeding anyway (server may already be down)');
        }
        console.log();

        deploy();
        console.log();

        console.log(bold('→ starting server detached'));
        const startRes = runNode(startScript, ['--background', '--save', SAVE_DIR, '--local']);
        if (startRes.status !== 0) {
            console.error(red('✗ start failed'));
            process.exit(startRes.status || 1);
        }
        console.log();
        console.log(bold('→ waiting for SynthOverseer setup line'));
    }

    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        const r = await tryVerifyOnce();
        if (r.code === 0) {
            process.stdout.write(r.out);
            return;
        }
        if (r.code === 2) {
            console.error(red('✗ server came up with the wrong tool set:'));
            process.stdout.write(r.out);
            process.exit(2);
        }
        process.stdout.write('.');
        await sleep(2000);
    }
    console.error();
    console.error(red('✗ timed out waiting for SynthOverseer to load'));
    process.exit(1);
}

async function main() {
    const verifyFlag = argv.includes('--verify') || argv.includes('-v');
    const restartFlag = argv.includes('--restart') || argv.includes('-r');
    if (verifyFlag) {
        verify();
    } else if (restartFlag) {
        await restart();
    } else {
        deploy();
    }
}

main();
