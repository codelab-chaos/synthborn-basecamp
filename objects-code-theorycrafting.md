# Objects + Code Theorycrafting: Settlement NPC Behavior Trees

This is a design sketch for autonomous Hytale settlement NPCs inspired by Erenshor's SimPlayers: cheap deterministic behavior, persistent memory, role specialization, grouping, and bounded off-screen progress. It assumes the verified Hytale pattern from the local quickrefs:

- NPC behavior lives primarily in JSON Roles and ordered instruction lists.
- Instructions behave like a priority selector: top-to-bottom, first matching instruction usually wins.
- Sensors query state, actions mutate state, and motions move the NPC.
- Custom Java elements should fill gaps, while the village-wide simulation stays in Java managers/components.
- `RoleChangeSystem.requestRoleChange(...)` can swap coarse roles at runtime.

The code below is intentionally theorycrafting. Verified API calls are kept close to `hytale-mod-quickref/09-verified-api-cheatsheet.md`; imagined/custom pieces are named with the `Synth...` prefix so they are obvious.

## Target Architecture

```text
NPC Role JSON
  - high-priority survival/combat instructions
  - role-specific instruction list
  - references custom Synth sensors/actions/motions

NPC components
  - identity, needs, role profile, memory summary
  - current claimed job, home/work zone ids

SettlementManager
  - job board
  - resource ledger
  - zones
  - alerts
  - off-screen simulation

Role-specific job executors
  - farmer, miner, defender, crafter, healer
  - small FSM per claimed job
```

This keeps the NPC "brain" small. The village is smart; individuals are believable.

## Core Object Model

```java
package com.ccnef.synthnpcs.sim;

import java.time.Instant;
import java.util.*;

public record SettlementId(UUID value) {}
public record CitizenId(UUID value) {}
public record ZoneId(String value) {}
public record JobId(UUID value) {}

public enum CitizenRole {
    FARMER,
    MINER,
    WOODCUTTER,
    CRAFTER,
    TANNER,
    DEFENDER,
    HEALER,
    HUNTER,
    BUILDER,
    SIM_PLAYER
}

public enum NeedKind {
    HUNGER,
    REST,
    SAFETY,
    SOCIAL,
    MORALE
}

public enum JobType {
    HARVEST_CROP,
    PLANT_CROP,
    DEPOSIT_ITEM,
    WITHDRAW_ITEM,
    MINE_BLOCK,
    CHOP_TREE,
    CRAFT_ITEM,
    PATROL,
    ENGAGE_THREAT,
    ESCORT_WORKER,
    HEAL_TARGET,
    SOCIALIZE,
    RETURN_HOME,
    SLEEP
}

public enum JobStatus {
    OPEN,
    RESERVED,
    RUNNING,
    COMPLETE,
    FAILED,
    EXPIRED
}

public record BlockPos(int x, int y, int z) {
    public double distanceSquared(BlockPos other) {
        long dx = x - other.x;
        long dy = y - other.y;
        long dz = z - other.z;
        return dx * dx + dy * dy + dz * dz;
    }
}

public record SimItem(String itemId, int count) {}

public final class NeedState {
    private final EnumMap<NeedKind, Double> values = new EnumMap<>(NeedKind.class);

    public NeedState() {
        for (NeedKind kind : NeedKind.values()) {
            values.put(kind, 0.0);
        }
    }

    public double get(NeedKind kind) {
        return values.getOrDefault(kind, 0.0);
    }

    public void set(NeedKind kind, double value) {
        values.put(kind, Math.max(0.0, Math.min(1.0, value)));
    }

    public boolean isCritical(NeedKind kind) {
        return get(kind) >= 0.85;
    }
}

public final class CitizenProfile {
    public final CitizenId id;
    public final String displayName;
    public final CitizenRole role;
    public final SettlementId settlementId;
    public final ZoneId homeZone;
    public final ZoneId workZone;
    public final Personality personality;
    public final NeedState needs = new NeedState();
    public JobId claimedJob;

    public CitizenProfile(
            CitizenId id,
            String displayName,
            CitizenRole role,
            SettlementId settlementId,
            ZoneId homeZone,
            ZoneId workZone,
            Personality personality) {
        this.id = id;
        this.displayName = displayName;
        this.role = role;
        this.settlementId = settlementId;
        this.homeZone = homeZone;
        this.workZone = workZone;
        this.personality = personality;
    }
}

public record Personality(
        String archetype,
        double bravery,
        double sociability,
        double diligence,
        double patience) {
}
```

## Jobs And Job Board

The Erenshor lesson is that coordination feels intelligent even when the pieces are simple. A job board prevents every farmer from scanning every crop every tick.

```java
package com.ccnef.synthnpcs.sim;

import java.time.Instant;
import java.util.*;
import java.util.function.Predicate;

public final class SettlementJob {
    public final JobId id;
    public final JobType type;
    public final Set<CitizenRole> allowedRoles;
    public final BlockPos target;
    public final ZoneId zoneId;
    public final int priority;
    public final Instant expiresAt;
    public final Map<String, String> params;

    public JobStatus status = JobStatus.OPEN;
    public CitizenId reservedBy;

    public SettlementJob(
            JobId id,
            JobType type,
            Set<CitizenRole> allowedRoles,
            BlockPos target,
            ZoneId zoneId,
            int priority,
            Instant expiresAt,
            Map<String, String> params) {
        this.id = id;
        this.type = type;
        this.allowedRoles = Set.copyOf(allowedRoles);
        this.target = target;
        this.zoneId = zoneId;
        this.priority = priority;
        this.expiresAt = expiresAt;
        this.params = Map.copyOf(params);
    }

    public boolean canBeClaimedBy(CitizenProfile citizen, Instant now) {
        return status == JobStatus.OPEN
                && expiresAt.isAfter(now)
                && allowedRoles.contains(citizen.role);
    }
}

public final class JobBoard {
    private final Map<JobId, SettlementJob> jobs = new HashMap<>();

    public void post(SettlementJob job) {
        jobs.put(job.id, job);
    }

    public Optional<SettlementJob> claimBest(
            CitizenProfile citizen,
            BlockPos currentPos,
            Instant now,
            Predicate<SettlementJob> extraFilter) {
        return jobs.values().stream()
                .filter(job -> job.canBeClaimedBy(citizen, now))
                .filter(extraFilter)
                .max(Comparator.comparingDouble(job -> score(job, currentPos)))
                .map(job -> {
                    job.status = JobStatus.RESERVED;
                    job.reservedBy = citizen.id;
                    citizen.claimedJob = job.id;
                    return job;
                });
    }

    public Optional<SettlementJob> get(JobId id) {
        return Optional.ofNullable(jobs.get(id));
    }

    public void complete(JobId id) {
        SettlementJob job = jobs.get(id);
        if (job != null) {
            job.status = JobStatus.COMPLETE;
        }
    }

    public void fail(JobId id) {
        SettlementJob job = jobs.get(id);
        if (job != null) {
            job.status = JobStatus.FAILED;
            job.reservedBy = null;
        }
    }

    private double score(SettlementJob job, BlockPos currentPos) {
        double distancePenalty = Math.sqrt(job.target.distanceSquared(currentPos)) * 0.5;
        return job.priority - distancePenalty;
    }
}
```

Example job payload:

```json
{
  "id": "9a99b8e6-farmer-job",
  "type": "HARVEST_CROP",
  "allowedRoles": ["FARMER"],
  "target": { "x": 120, "y": 64, "z": 88 },
  "zoneId": "Farm_North",
  "priority": 70,
  "expiresAt": "2026-05-26T12:00:00Z",
  "params": {
    "cropBlock": "Crop_Wheat_Mature",
    "dropItem": "Item_Wheat"
  }
}
```

## Settlement Manager

This is the server-side village brain. It should tick slowly, e.g. every 1-5 seconds for job generation and resource scoring, not every NPC tick.

```java
package com.ccnef.synthnpcs.sim;

import java.time.Instant;
import java.util.*;

public final class SettlementManager {
    private final Map<SettlementId, SettlementState> settlements = new HashMap<>();

    public SettlementState getOrCreate(SettlementId id) {
        return settlements.computeIfAbsent(id, SettlementState::new);
    }

    public void tickAll(Instant now) {
        for (SettlementState settlement : settlements.values()) {
            settlement.tickStrategicLayer(now);
        }
    }
}

public final class SettlementState {
    public final SettlementId id;
    public final JobBoard jobs = new JobBoard();
    public final ResourceLedger resources = new ResourceLedger();
    public final Map<ZoneId, SettlementZone> zones = new HashMap<>();
    public final List<SettlementAlert> alerts = new ArrayList<>();

    public SettlementState(SettlementId id) {
        this.id = id;
    }

    public void tickStrategicLayer(Instant now) {
        postFoodJobs(now);
        postDefenseJobs(now);
        postCraftingJobs(now);
    }

    private void postFoodJobs(Instant now) {
        if (resources.count("Item_Wheat") < 32) {
            // Real implementation would scan known farm-zone crop caches, not the whole world.
            for (SettlementZone zone : zones.values()) {
                if (zone.kind() == ZoneKind.FARM) {
                    jobs.post(JobFactories.harvestKnownCrop(zone, now, 80));
                }
            }
        }
    }

    private void postDefenseJobs(Instant now) {
        boolean raidActive = alerts.stream().anyMatch(alert -> alert.type() == AlertType.RAID);
        if (!raidActive) {
            return;
        }

        zones.values().stream()
                .filter(zone -> zone.kind() == ZoneKind.GUARD_POST)
                .forEach(zone -> jobs.post(JobFactories.patrol(zone, now, 95)));
    }

    private void postCraftingJobs(Instant now) {
        if (resources.count("Tool_Iron_Pickaxe") < 2 && resources.count("Resource_Iron_Ore") >= 3) {
            jobs.post(JobFactories.craftTool("Tool_Iron_Pickaxe", now, 65));
        }
    }
}

public enum ZoneKind {
    VILLAGE_CENTER,
    HOME,
    FARM,
    MINE,
    FOREST,
    STORAGE,
    WORKSHOP,
    CLINIC,
    GUARD_POST,
    SHELTER
}

public record SettlementZone(ZoneId id, ZoneKind kind, BlockPos center, int radius) {}
public enum AlertType { RAID, FOOD_SHORTAGE, WORKER_DOWN, CAVE_DANGER }
public record SettlementAlert(AlertType type, BlockPos location, int priority, Instant expiresAt) {}

public final class ResourceLedger {
    private final Map<String, Integer> counts = new HashMap<>();

    public int count(String itemId) {
        return counts.getOrDefault(itemId, 0);
    }

    public void add(String itemId, int count) {
        counts.merge(itemId, count, Integer::sum);
    }

    public boolean consume(String itemId, int count) {
        int current = count(itemId);
        if (current < count) {
            return false;
        }
        counts.put(itemId, current - count);
        return true;
    }
}
```

## Hytale Component Sketches

The exact component registration mechanics should follow the current server API. The shape matters more than the syntax here: persist identity and simulation state separately from the Role JSON.

```java
package com.ccnef.synthnpcs.components;

import com.ccnef.synthnpcs.sim.*;
import java.util.UUID;

public final class SynthCitizenComponent {
    public UUID citizenId;
    public UUID settlementId;
    public String role;
    public String homeZone;
    public String workZone;
    public String personality;
    public UUID claimedJobId;

    public double hunger;
    public double rest;
    public double safety;
    public double social;
    public double morale;
}

public final class SynthMemoryComponent {
    public UUID citizenId;
    public String knownPlayerName;
    public int groupedWithPlayerCount;
    public int giftsReceived;
    public int timesRescuedByPlayer;
    public int timesAbandonedByPlayer;
    public double playerTrust;
    public double playerAnnoyance;
    public long lastInteractionEpochMs;
}
```

Memory should be small and queryable. Do not store full chat transcripts for every citizen unless there is a separate summarization/caching layer.

## Behavior Tree Shape

Hytale instruction lists already act like priority selectors. The settlement NPC root should be ordered like this:

```text
Root
  1. Damage / hostile detected -> Alerted or Combat
  2. Raid alarm + noncombatant -> FleeToShelter
  3. Health low -> SeekHealer
  4. Hunger critical -> EatOrFindFood
  5. Rest critical or sleep hours -> Sleep
  6. Inventory full -> DepositInventory
  7. Claimed job exists -> ExecuteClaimedJob
  8. Work hours -> ClaimBestRoleJob
  9. Social hours -> Socialize
  10. Default -> Wander / idle flavor
```

That gives every role the same "survivor core." Farmer, miner, and crafter differences come from which jobs they are allowed to claim and which executor handles the job.

## Role JSON Pattern

This is a proposed role asset pattern. The built-in `Template_Citizen.json` shows real concepts like `Type`, `Reference`, `Parameters`, `StartState`, `Instructions`, `State`, `Target`, `Beacon`, `Seek`, `Attack`, `Timeout`, `Random`, and `Continue`. `Synth...` elements below are custom elements we would implement in Java.

```jsonc
{
  "Type": "Variant",
  "Reference": "Template_Citizen",
  "Name": "Synth_Farmer_Role",
  "StartState": "Idle",
  "Parameters": {
    "DefaultPlayerAttitude": { "Value": "Neutral" },
    "DefaultNPCAttitude": { "Value": "Ignore" },
    "ViewRange": { "Value": 18 },
    "HearingRange": { "Value": 10 },
    "MaxSpeed": { "Value": 7 },
    "Weapons": { "Value": ["Tool_Hoe"] },
    "DefaultHotbarSlot": { "Value": 0 },
    "SynthRole": { "Value": "FARMER" }
  },
  "Instructions": [
    {
      "$Comment": "Top-level priority selector for settlement behavior.",
      "Instructions": [
        {
          "Sensor": {
            "Reference": "Component_Sensor_Standard_Detection",
            "Modify": {
              "ViewRange": { "Compute": "ViewRange" },
              "HearingRange": { "Compute": "HearingRange" },
              "Attitudes": ["Hostile"]
            }
          },
          "Actions": [
            { "Type": "State", "State": "Alerted" }
          ]
        },
        {
          "Sensor": {
            "Type": "SynthSettlementAlert",
            "AlertType": "RAID",
            "NonCombatantOnly": true
          },
          "Actions": [
            {
              "Type": "SynthClaimEmergencyJob",
              "JobType": "RETURN_HOME",
              "TargetZoneKind": "SHELTER"
            }
          ],
          "BodyMotion": {
            "Type": "SynthSeekClaimedJobTarget",
            "RelativeSpeed": 0.85,
            "UsePathfinder": true
          }
        },
        {
          "Sensor": {
            "Type": "SynthNeedThreshold",
            "Need": "HUNGER",
            "AtLeast": 0.85
          },
          "Actions": [
            { "Type": "SynthEatFromInventoryOrStorage" }
          ]
        },
        {
          "Sensor": {
            "Type": "SynthShouldSleep"
          },
          "Actions": [
            {
              "Type": "SynthClaimEmergencyJob",
              "JobType": "SLEEP",
              "TargetZoneKind": "HOME"
            }
          ],
          "BodyMotion": {
            "Type": "SynthSeekClaimedJobTarget",
            "RelativeSpeed": 0.55,
            "UsePathfinder": true
          }
        },
        {
          "Sensor": {
            "Type": "SynthInventoryFull"
          },
          "Actions": [
            {
              "Type": "SynthClaimEmergencyJob",
              "JobType": "DEPOSIT_ITEM",
              "TargetZoneKind": "STORAGE"
            }
          ],
          "BodyMotion": {
            "Type": "SynthSeekClaimedJobTarget",
            "RelativeSpeed": 0.6,
            "UsePathfinder": true
          }
        },
        {
          "Sensor": {
            "Type": "SynthHasClaimedJob"
          },
          "Actions": [
            { "Type": "SynthExecuteClaimedJobStep" }
          ],
          "BodyMotion": {
            "Type": "SynthSeekClaimedJobTarget",
            "RelativeSpeed": 0.65,
            "UsePathfinder": true
          }
        },
        {
          "Sensor": {
            "Type": "SynthWorkHours"
          },
          "Actions": [
            {
              "Type": "SynthClaimBestJob",
              "AllowedRole": "FARMER",
              "PreferredZoneKind": "FARM"
            }
          ]
        },
        {
          "Sensor": {
            "Type": "SynthSocialHours"
          },
          "Actions": [
            { "Type": "SynthTrySocialInteraction" }
          ]
        },
        {
          "$Comment": "Default idle fallback.",
          "BodyMotion": {
            "Type": "WanderInCircle",
            "Radius": 8,
            "RelativeSpeed": 0.35
          }
        }
      ]
    }
  ]
}
```

## Farmer Job Executor

The Role JSON chooses "execute claimed job." Java owns the reliable job FSM.

```java
package com.ccnef.synthnpcs.jobs;

import com.ccnef.synthnpcs.sim.*;

public final class FarmerJobExecutor implements JobExecutor {
    @Override
    public JobStepResult step(JobContext ctx, SettlementJob job) {
        return switch (job.type) {
            case HARVEST_CROP -> harvest(ctx, job);
            case PLANT_CROP -> plant(ctx, job);
            case DEPOSIT_ITEM -> deposit(ctx, job);
            case WITHDRAW_ITEM -> withdraw(ctx, job);
            default -> JobStepResult.notSupported();
        };
    }

    private JobStepResult harvest(JobContext ctx, SettlementJob job) {
        if (!ctx.isNear(job.target, 2.0)) {
            ctx.blackboard().setMoveTarget(job.target);
            return JobStepResult.moving();
        }

        String cropBlock = job.params.getOrDefault("cropBlock", "Crop_Wheat_Mature");
        if (!ctx.world().isBlock(job.target, cropBlock)) {
            return JobStepResult.failed("Crop is no longer mature.");
        }

        ctx.world().breakBlock(job.target);
        ctx.inventory().add("Item_Wheat", 1);
        ctx.memory().recordEvent("harvested_wheat");
        return JobStepResult.complete();
    }

    private JobStepResult plant(JobContext ctx, SettlementJob job) {
        if (!ctx.isNear(job.target, 2.0)) {
            ctx.blackboard().setMoveTarget(job.target);
            return JobStepResult.moving();
        }

        if (!ctx.inventory().consume("Item_Wheat_Seed", 1)) {
            return JobStepResult.failed("Missing seeds.");
        }

        ctx.world().placeBlock(job.target, "Crop_Wheat_Seeded");
        return JobStepResult.complete();
    }

    private JobStepResult deposit(JobContext ctx, SettlementJob job) {
        if (!ctx.isNear(job.target, 2.0)) {
            ctx.blackboard().setMoveTarget(job.target);
            return JobStepResult.moving();
        }

        int deposited = ctx.inventory().depositAllMatching(job.target, item -> item.itemId().startsWith("Item_Wheat"));
        ctx.settlement().resources.add("Item_Wheat", deposited);
        return JobStepResult.complete();
    }

    private JobStepResult withdraw(JobContext ctx, SettlementJob job) {
        if (!ctx.isNear(job.target, 2.0)) {
            ctx.blackboard().setMoveTarget(job.target);
            return JobStepResult.moving();
        }

        int count = Integer.parseInt(job.params.getOrDefault("count", "8"));
        boolean ok = ctx.inventory().withdraw(job.target, "Item_Wheat_Seed", count);
        return ok ? JobStepResult.complete() : JobStepResult.failed("Seed storage empty.");
    }
}
```

Supporting interfaces:

```java
package com.ccnef.synthnpcs.jobs;

import com.ccnef.synthnpcs.sim.*;

public interface JobExecutor {
    JobStepResult step(JobContext ctx, SettlementJob job);
}

public record JobStepResult(JobStepStatus status, String reason) {
    public static JobStepResult moving() {
        return new JobStepResult(JobStepStatus.MOVING, "");
    }

    public static JobStepResult complete() {
        return new JobStepResult(JobStepStatus.COMPLETE, "");
    }

    public static JobStepResult failed(String reason) {
        return new JobStepResult(JobStepStatus.FAILED, reason);
    }

    public static JobStepResult notSupported() {
        return new JobStepResult(JobStepStatus.NOT_SUPPORTED, "");
    }
}

public enum JobStepStatus {
    MOVING,
    RUNNING,
    COMPLETE,
    FAILED,
    NOT_SUPPORTED
}

public interface JobContext {
    CitizenProfile citizen();
    SettlementState settlement();
    SimWorldAccess world();
    SimInventoryAccess inventory();
    SimBlackboard blackboard();
    SimMemoryAccess memory();
    boolean isNear(BlockPos pos, double range);
}

public interface SimWorldAccess {
    boolean isBlock(BlockPos pos, String blockId);
    void breakBlock(BlockPos pos);
    void placeBlock(BlockPos pos, String blockId);
}

public interface SimInventoryAccess {
    void add(String itemId, int count);
    boolean consume(String itemId, int count);
    int depositAllMatching(BlockPos storagePos, java.util.function.Predicate<SimItem> filter);
    boolean withdraw(BlockPos storagePos, String itemId, int count);
}

public interface SimBlackboard {
    void setMoveTarget(BlockPos pos);
}

public interface SimMemoryAccess {
    void recordEvent(String eventKey);
}
```

## Custom Element Sketches

These are the Java primitives the JSON would reference. Exact inheritance/registration depends on the Hytale element API, but the concept is stable:

```java
package com.ccnef.synthnpcs.ai;

public final class SynthNeedThresholdSensor {
    public String need;
    public double atLeast;

    public boolean test(SynthAiContext ctx) {
        return ctx.citizen().needs.get(parseNeed(need)) >= atLeast;
    }

    private NeedKind parseNeed(String value) {
        return NeedKind.valueOf(value.toUpperCase(java.util.Locale.ROOT));
    }
}

public final class SynthClaimBestJobAction {
    public String allowedRole;
    public String preferredZoneKind;

    public void run(SynthAiContext ctx) {
        CitizenRole role = CitizenRole.valueOf(allowedRole);
        ZoneKind zoneKind = ZoneKind.valueOf(preferredZoneKind);

        ctx.settlement().jobs.claimBest(
                ctx.citizen(),
                ctx.currentBlockPos(),
                ctx.now(),
                job -> job.allowedRoles.contains(role)
                        && ctx.settlement().zones.get(job.zoneId).kind() == zoneKind);
    }
}

public final class SynthExecuteClaimedJobStepAction {
    private final JobExecutorRegistry executors;

    public SynthExecuteClaimedJobStepAction(JobExecutorRegistry executors) {
        this.executors = executors;
    }

    public void run(SynthAiContext ctx) {
        if (ctx.citizen().claimedJob == null) {
            return;
        }

        ctx.settlement().jobs.get(ctx.citizen().claimedJob).ifPresent(job -> {
            JobExecutor executor = executors.forRole(ctx.citizen().role);
            JobStepResult result = executor.step(ctx.jobContext(), job);

            if (result.status() == JobStepStatus.COMPLETE) {
                ctx.settlement().jobs.complete(job.id);
                ctx.citizen().claimedJob = null;
            } else if (result.status() == JobStepStatus.FAILED) {
                ctx.settlement().jobs.fail(job.id);
                ctx.citizen().claimedJob = null;
                ctx.memory().recordEvent("job_failed:" + result.reason());
            }
        });
    }
}
```

## Defender Role Variant

Defender differs mostly by allowed jobs and combat defaults. Let Hytale's combat behavior do combat; custom systems decide when a guard should claim patrol, escort, or intercept jobs.

```jsonc
{
  "Type": "Variant",
  "Reference": "Template_Citizen",
  "Name": "Synth_Defender_Role",
  "Parameters": {
    "DefaultPlayerAttitude": { "Value": "Neutral" },
    "DefaultNPCAttitude": { "Value": "Ignore" },
    "AttitudeGroup": { "Value": "Settlement_Guard" },
    "Weapons": { "Value": ["Weapon_Sword_Iron", "Weapon_Bow"] },
    "DefaultHotbarSlot": { "Value": 0 },
    "MaxHealth": { "Value": 140 },
    "ViewRange": { "Value": 28 },
    "HearingRange": { "Value": 16 },
    "UseCombatActionEvaluator": { "Value": true },
    "SynthRole": { "Value": "DEFENDER" }
  },
  "Instructions": [
    {
      "Instructions": [
        {
          "Sensor": {
            "Reference": "Component_Sensor_Standard_Detection",
            "Modify": {
              "ViewRange": { "Compute": "ViewRange" },
              "HearingRange": { "Compute": "HearingRange" },
              "Attitudes": ["Hostile"]
            }
          },
          "Actions": [
            { "Type": "SynthPostAlert", "AlertType": "RAID" },
            { "Type": "State", "State": "Combat" }
          ]
        },
        {
          "Sensor": { "Type": "SynthWorkerNeedsEscort" },
          "Actions": [
            {
              "Type": "SynthClaimBestJob",
              "AllowedRole": "DEFENDER",
              "PreferredZoneKind": "MINE"
            }
          ]
        },
        {
          "Sensor": { "Type": "SynthWorkHours" },
          "Actions": [
            {
              "Type": "SynthClaimBestJob",
              "AllowedRole": "DEFENDER",
              "PreferredZoneKind": "GUARD_POST"
            }
          ]
        },
        {
          "Sensor": { "Type": "SynthHasClaimedJob" },
          "Actions": [
            { "Type": "SynthExecuteClaimedJobStep" }
          ],
          "BodyMotion": {
            "Type": "SynthSeekClaimedJobTarget",
            "RelativeSpeed": 0.75,
            "UsePathfinder": true
          }
        },
        {
          "BodyMotion": {
            "Type": "WanderInCircle",
            "Radius": 12,
            "RelativeSpeed": 0.45
          }
        }
      ]
    }
  ]
}
```

## SimPlayer Party Layer

Erenshor-style SimPlayers can sit above the settlement layer. They are "citizens who adventure."

```java
package com.ccnef.synthnpcs.party;

import com.ccnef.synthnpcs.sim.*;
import java.util.*;

public enum PartyRole {
    MAIN_TANK,
    MAIN_ASSIST,
    HEALER,
    CROWD_CONTROL,
    PULLER,
    DAMAGE
}

public final class SimParty {
    public final UUID id = UUID.randomUUID();
    public final List<CitizenId> members = new ArrayList<>();
    public final Map<CitizenId, PartyRole> roles = new HashMap<>();
    public BlockPos destination;
    public PartyObjective objective;
    public CitizenId invitedPlayerProxy;
}

public enum PartyObjective {
    FORMING,
    TRAVEL_TO_DUNGEON,
    CLEAR_CAMP,
    LOOT,
    RETURN_TO_TOWN,
    REST
}

public final class PartyMatcher {
    public boolean canInvite(CitizenProfile citizen, SimParty party) {
        if (party.members.contains(citizen.id)) {
            return false;
        }
        if (citizen.needs.isCritical(NeedKind.REST) || citizen.needs.isCritical(NeedKind.HUNGER)) {
            return false;
        }
        return switch (citizen.role) {
            case DEFENDER -> !party.roles.containsValue(PartyRole.MAIN_TANK);
            case HEALER -> !party.roles.containsValue(PartyRole.HEALER);
            case HUNTER -> !party.roles.containsValue(PartyRole.PULLER);
            default -> party.members.size() < 5;
        };
    }
}
```

Party behavior tree:

```text
SimPlayerRoot
  1. Party member down -> healer triage / retreat
  2. Hostile engaged -> combat role behavior
  3. Not in party + social/adventure hours -> seek party
  4. Party forming + missing role -> invite candidate/player
  5. Party full -> travel to objective
  6. Objective complete -> loot, remember, return
  7. Downtime -> town routine
```

Example Erenshor-like memory events:

```java
public enum MemoryEventType {
    GROUPED_WITH_PLAYER,
    PLAYER_ACCEPTED_INVITE,
    PLAYER_DECLINED_INVITE,
    PLAYER_GAVE_ITEM,
    PLAYER_SAVED_CITIZEN,
    PLAYER_ABANDONED_GROUP,
    DUNGEON_COMPLETED,
    PARTY_WIPE
}

public record MemoryEvent(
        MemoryEventType type,
        String subjectId,
        String summary,
        long epochMs,
        double importance) {
}
```

Dialogue should read from memory and state, not drive behavior:

```java
public final class DialogueContext {
    public String playerName;
    public CitizenProfile citizen;
    public SynthMemorySnapshot memory;
    public SettlementState settlement;
    public Optional<SimParty> party;
}

public final class DialogueSelector {
    public String greeting(DialogueContext ctx) {
        if (ctx.memory.playerTrust() > 0.75 && ctx.memory.groupedWithPlayerCount() > 0) {
            return "Good to see you, " + ctx.playerName + ". Still standing after our last run, then?";
        }
        if (ctx.settlement.resources.count("Item_Wheat") < 12) {
            return "Food stores are thin. If you see wheat or game, the camp could use it.";
        }
        return "Safe roads, " + ctx.playerName + ".";
    }
}
```

## Off-Screen Simulation

When a settlement is unloaded or no players are nearby, stop expensive pathing and run a coarse tick. This is the Erenshor move: the world advances without needing every action animated.

```java
package com.ccnef.synthnpcs.sim;

import java.time.Duration;
import java.time.Instant;

public final class OffscreenSettlementSimulator {
    private static final Duration MAX_CATCHUP = Duration.ofHours(6);

    public void catchUp(SettlementState settlement, Instant lastSeen, Instant now) {
        Duration elapsed = Duration.between(lastSeen, now);
        Duration simulated = elapsed.compareTo(MAX_CATCHUP) > 0 ? MAX_CATCHUP : elapsed;

        long hours = Math.max(1, simulated.toHours());
        for (long hour = 0; hour < hours; hour++) {
            simulateHour(settlement);
        }
    }

    private void simulateHour(SettlementState settlement) {
        int farmers = countRole(settlement, CitizenRole.FARMER);
        int miners = countRole(settlement, CitizenRole.MINER);
        int defenders = countRole(settlement, CitizenRole.DEFENDER);

        settlement.resources.add("Item_Wheat", farmers * 6);
        settlement.resources.add("Resource_Stone", miners * 10);
        settlement.resources.add("Resource_Iron_Ore", miners * 2);

        int foodNeeded = countCitizens(settlement) * 2;
        settlement.resources.consume("Item_Wheat", foodNeeded);

        if (defenders == 0) {
            settlement.alerts.add(new SettlementAlert(
                    AlertType.RAID,
                    findVillageCenter(settlement),
                    50,
                    Instant.now().plusSeconds(3600)));
        }
    }

    private int countRole(SettlementState settlement, CitizenRole role) {
        // Backed by a citizen registry in the real implementation.
        return 0;
    }

    private int countCitizens(SettlementState settlement) {
        return 0;
    }

    private BlockPos findVillageCenter(SettlementState settlement) {
        return settlement.zones.values().stream()
                .filter(zone -> zone.kind() == ZoneKind.VILLAGE_CENTER)
                .findFirst()
                .map(SettlementZone::center)
                .orElse(new BlockPos(0, 64, 0));
    }
}
```

Rubber-band progression so SimPlayers remain peers:

```java
public final class SimProgression {
    public int targetLevelForNpc(int playerLevel, int currentNpcLevel, long offlineHours) {
        int maxCatchupGain = (int) Math.min(3, offlineHours / 6);
        int desired = Math.max(1, playerLevel + randomOffsetNearPlayer());
        int capped = Math.min(currentNpcLevel + maxCatchupGain, desired);
        return Math.max(currentNpcLevel, capped);
    }

    private int randomOffsetNearPlayer() {
        return java.util.concurrent.ThreadLocalRandom.current().nextInt(-2, 2);
    }
}
```

## MVP Build Order

1. Farmer role only: farm zone, storage zone, wheat harvest, seed planting, deposit.
2. Citizen component: role, settlement id, needs, claimed job.
3. Job board: claim/complete/fail, no scanning in the NPC tick.
4. Custom JSON elements: `SynthClaimBestJob`, `SynthHasClaimedJob`, `SynthExecuteClaimedJobStep`, `SynthSeekClaimedJobTarget`.
5. Defender role: patrol job, hostile alert, noncombatants flee to shelter.
6. Memory: player trust, grouped count, gifts, rescues, abandonment.
7. Off-screen tick: bounded 6-hour catch-up, resource deltas, level rubber-banding.
8. SimPlayer party loop: form party, invite, travel, fight, loot, return, remember.

## Design Rules To Keep The System Believable

- Put survival and danger checks above work checks in every Role.
- Use role JSON for priority and movement, Java managers for shared knowledge.
- Let jobs reserve targets so five NPCs do not harvest the same crop.
- Use zones aggressively. "Find any tree anywhere" is brittle; "work this forest zone" is sane.
- Keep memory numeric and summarized. Dialogue reads memory; memory should not run the NPC.
- Run off-screen simulation in coarse deltas and cap catch-up so the village never races away from the player.
- Prefer deterministic outcomes, with small randomness for timing and flavor.
