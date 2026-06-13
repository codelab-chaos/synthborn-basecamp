# 02 — Server Plugins

*The plugin skeleton: lifecycle, manifest, the singleton pattern, registries, and depending on other plugins.*

Sources: 🌐 [Plugin System](https://hytale-docs.pages.dev/modding/plugins/plugin-system/), ✅ `_mod-example-sourcecode/NPCTrading/.../TraderInteraction.java`, ✅ `_mod-example-sourcecode/HyCitizens/.../HyCitizensPlugin.java`

---

## The base class & lifecycle 🌐✅

A plugin extends `JavaPlugin` and implements up to three lifecycle hooks:

```java
public class MyPlugin extends JavaPlugin {

    public MyPlugin(@Nonnull JavaPluginInit init) {
        super(init);
    }

    @Override
    protected void setup() {
        // Server initialization. Register events, commands, components here.
        instance = this;
        getLogger().at(Level.INFO).log("Plugin setup complete!");
    }

    @Override
    protected void start() {
        // Runs after ALL plugins are set up. Safe to touch other plugins / start tasks.
        getLogger().at(Level.INFO).log("Plugin started!");
    }

    @Override
    protected void shutdown() {
        // Server stopping. Persist state, cancel tasks, release resources.
    }
}
```

| Hook | When | Use it for |
|---|---|---|
| `setup()` | During server init | Registering events, commands, ECS systems, asset types |
| `start()` | After **all** plugins set up | Anything that touches other plugins; background tasks |
| `shutdown()` | Server stopping | Saving data, cancelling tasks, cleanup |

> **Ordering matters:** never reach into another plugin from `setup()` — it may not be set up yet. Do cross-plugin work in `start()`. (This is why NPCTrading's optional-dependency check works reliably.)

## The manifest 🌐

Every plugin ships a `manifest.json`:

```json
{
  "Group": "com.example",
  "Name": "MyPlugin",
  "Version": "1.0.0",
  "Main": "com.example.MyPlugin",
  "Dependencies": { "Hytale:SomePlugin": ">=1.0.0" },
  "DisabledByDefault": false
}
```

The plugin **identifier** is `"Group:Name"` → e.g. `com.example:MyPlugin`.

### `ServerVersion` — declare it, and match it exactly ✅🌐

The manifest **must** include a `ServerVersion` matching the server build you run, e.g. `"ServerVersion": "2026.03.26-89796e57b"`.

- **Plain string equality, not semver.** Since Update 3 the server compares `ServerVersion` to its own build string with an exact equality check — a range like `>=...` or `*` will **not** satisfy it (🌐 [doctale.dev — Plugin Manifest](https://doctale.dev/getting-started/plugin-manifest/)).
- **Omitting it (or `"*"`) is logged and will become fatal.** Observed in a real `synth-test-01` server log (✅): `WARN [PluginManager] Plugin '<id>' does not specify a target server version … This will be a hard error in the future`, followed by `SEVERE … One or more plugins are targeting a different server version.`
- **Find your build string** in the boot banner of the save's log — `<save>/logs/*_server.log` → `Booting up HytaleServer - Version: 2026.03.26-89796e57b, Revision: …`.
- **Keep the Gradle dep pinned to the same string.** Prefer `compileOnly("com.hypixel.hytale:Server:2026.03.26-89796e57b")` over `latest.release`: because validation is exact-match, a `latest.release` that drifts ahead of your installed game silently reintroduces the mismatch on the next `clean build`. Bump the dep and `ServerVersion` together on game updates. (✅ SynthUnits; ✅ HyCitizens declares `2026.03.26-89796e57b`, NPCTrading `2026.02.19-1a311a592`.)

## Singleton `get()` pattern (hot-reload safe) 🌐✅

Both repo plugins use this. It's the idiomatic way to expose your plugin's API to other plugins:

```java
private static MyPlugin instance;
public static MyPlugin get() { return instance; }

@Override
protected void setup() { instance = this; }
```

Then anywhere: `MyPlugin.get().getSomeManager()`. (✅ `HyCitizensPlugin.get().getCitizensManager()`, `NPCTradingPlugin.get().getTradersManager()`.)

## Registries 🌐

Plugins reach engine subsystems through getters on `JavaPlugin`:

| Getter | For |
|---|---|
| `getEventRegistry()` | Game events → [03-events.md](./03-events.md) |
| `getCommandRegistry()` | Slash commands (`registerCommand(...)`, `Command` interface) |
| `getTaskRegistry()` | Scheduled/timed tasks |
| `getLogger()` | Structured logging: `getLogger().at(Level.INFO).log("…")` |

## Commands 🌐

```java
@Override
protected void setup() {
    getCommandRegistry().registerCommand(new MySpawnCommand());
}
// MySpawnCommand implements the Command interface (argument parsing via the command API).
```

(✅ HyCitizens registers `/citizens` and NPCTrading `/npctrading` / `/nt` this way.)

## Depending on another plugin (the companion-plugin pattern) ✅

This is the **verified** seam from `_mod-example-sourcecode/NPCTrading/.../TraderInteraction.java` — the canonical way to attach to another plugin as an *optional* dependency:

```java
import com.hypixel.hytale.common.plugin.PluginIdentifier;
import com.hypixel.hytale.server.core.plugin.PluginManager;

PluginIdentifier id = new PluginIdentifier("com.electro", "HyCitizens");
if (PluginManager.get().getPlugin(id) == null) {
    return;                       // dependency absent → no-op, degrade gracefully
}

// Safe to use the dependency now:
HyCitizensPlugin.get().getCitizensManager().addCitizenInteractListener(event -> {
    CitizenData citizen = event.getCitizen();
    PlayerRef   player  = event.getPlayer();
    // … react …
});
```

Key points:
- `PluginManager.get().getPlugin(id)` returns `null` if not installed — guard on it.
- Do this in `start()` (or a listener), not `setup()`, so the other plugin is ready.
- Declare it in `manifest.json` `Dependencies` if it's a **hard** dependency; omit it (and guard) for an **optional** one.

## Build setup ✅

The repo plugins use **Gradle (Kotlin DSL)** — `build.gradle.kts`, `settings.gradle.kts`, the Gradle wrapper. **JUnit 5** is already available (`junit-bom:5.10.0`), so unit tests need no extra infra. Plugins bundle library jars under `libs/` (e.g. `HyUI-*.jar` for UI). Output is a `.jar` dropped into the server's plugins directory.

## Minimal plugin checklist

- [ ] `extends JavaPlugin` with the `JavaPluginInit` constructor
- [ ] `manifest.json` with `Group`, `Name`, `Version`, `Main`
- [ ] `setup()` registers events/commands; `start()` does cross-plugin work; `shutdown()` saves
- [ ] static `instance` + `get()` if you expose an API
- [ ] optional deps guarded with `PluginManager.get().getPlugin(...)`
