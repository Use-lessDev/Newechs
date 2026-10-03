// Tomares v1.11.5 - sectioned full-block research with drill overlay variants and lighter research refresh
var LANG_KEY = "tomares-lang";
var PREFIX = "tomares-up-";
var PARTIAL = "tomares-part-";
var SAVE_PREFIX = "tomares-save-v2-";
var SAVE_TAG_PREFIX = "tomares-upgrades-v2-";

var persistentLevels = {};
var persistentMissions = {};
var persistentPoints = 0;
var persistentShop = null;
var persistentPointMissions = null;
var persistentPartial = {};
var activeStoreKey = null;
var activeTagKey = null;
var appliedMap = {};
var globalTransportTargets = {};
var lastSelected = null;
var pendingSelectBuild = null;
var pendingSelectTime = -999999;
var DOUBLE_TAP_WINDOW = 30; // ~0.5s at 60 FPS
var selectTable = null;
var researchHudTable = null;
var selectCacheKey = null;
var HISTORY_KEY = "newtechs-history";
var HISTORY_MAX = 80;
var upgradeHistory = [];
var NET_PACKET = "newtechs";
var bulletBaseSnapshot = {};
var bulletCatalogBuilt = false;
var INSTALL_BAR_X = "tomares-install-bar-x";
var INSTALL_BAR_Y = "tomares-install-bar-y";
var masterActivationKey = null;
var masterAppliedTeamId = -1;
var masterBaseState = {};
var FAVORITES_KEY = "newtechs-favorites";
var DAILY_BONUS_KEY = "newtechs-daily-bonus";
var favoriteBlocks = {};
var installFlashBuilds = [];
var SPEC_KEY = "newtechs-spec-path";
var specializationPath = null;
var activeContracts = null;
var CONTRACT_KEY = "newtechs-contracts";



// Ammo extra system removed (did not work reliably). Stubs keep old saves from crashing.
function javaAmmoTurretClass(){ return null; }
function attachNewTechAmmoTurret(block){ return null; }
var NewTechAmmo = {
    reset: function(){},
    register: function(){ return null; },
    unlock: function(){ return false; },
    refreshAll: function(){ return 0; },
    refreshUpgrade: function(){},
    validate: function(){ return true; },
    capture: function(){ return null; },
    entryKey: function(){ return ""; }
};
function activateResearchedAmmo(){ return 0; }
function buildAmmoCatalog(){}
function addAmmoGroupForTurret(){}
function markAmmoItemAccepted(){}
function ammoCandidateItems(){ return []; }
function ammoRoleForItem(){ return "standard"; }
function cloneAmmoBullet(){ return null; }
function chooseAmmoSourceItem(){ return null; }
function ammoUpgradeId(){ return ""; }
function addUsefulAmmoGlobal(){ return false; }



// ---- NT transport: NEW block classes (imitation of vanilla, own Build class) ----
// Sprites are taken from vanilla in load()/ClientLoad — without that you only see a shadow.

function ntTransportTimeScale(build){
    try{
        if(build == null || build.block == null) return 1;
        var name = "" + build.block.name;
        if(name.indexOf("newtech-nt-") === 0) name = name.substring("newtech-nt-".length);
        if(Vars.player == null || build.team !== Vars.player.team()) return 1;
        var f = globalFactorByBlock[name];
        if(f == null || f <= 0) return 1;
        return 1 + f;
    }catch(e){ return 1; }
}

function ntCopyVisuals(dst, src){
    // Conveyors draw with regions[blend][frame] loaded as name-0-0 .. name-6-3
    // Copying only region leaves a SHADOW. Must copy the full regions grid.
    if(dst == null || src == null) return false;
    var ok = false;
    try{
        var vname = "" + src.name;
        // Prefer sharing the exact region arrays from vanilla (same atlas UVs)
        try{
            if(src.regions != null){
                dst.regions = src.regions;
                ok = true;
            }
        }catch(eR){}
        // Fallback: load by vanilla atlas keys conveyor-0-0 etc.
        if(!ok){
            try{
                var grid = [];
                var found = 0;
                for(var i = 0; i < 7; i++){
                    grid[i] = [];
                    for(var j = 0; j < 4; j++){
                        var reg = Core.atlas.find(vname + "-" + i + "-" + j);
                        grid[i][j] = reg;
                        if(reg != null && reg.found && reg.found()) found++;
                    }
                }
                if(found > 0){
                    dst.regions = grid;
                    ok = true;
                }
            }catch(eG){}
        }
        // Conduit-style multi regions
        try{ if(src.topRegions != null){ dst.topRegions = src.topRegions; ok = true; } }catch(eT){}
        try{ if(src.botRegions != null){ dst.botRegions = src.botRegions; ok = true; } }catch(eB){}
        try{ if(src.capRegion != null){ dst.capRegion = src.capRegion; ok = true; } }catch(eC){}
        try{ if(src.rotateRegions != null){ dst.rotateRegions = src.rotateRegions; ok = true; } }catch(eRR){}
        // Generic
        try{ if(src.region != null){ dst.region = src.region; ok = true; } }catch(e1){}
        try{ if(src.uiIcon != null) dst.uiIcon = src.uiIcon; }catch(e2){}
        try{ if(src.fullIcon != null) dst.fullIcon = src.fullIcon; }catch(e3){}
        try{ if(src.teamRegion != null) dst.teamRegion = src.teamRegion; }catch(e4){}
        try{ if(src.drawer != null) dst.drawer = src.drawer; }catch(e5){}
        // Icons from regions if missing
        try{
            if((dst.uiIcon == null || (dst.uiIcon.found && !dst.uiIcon.found())) && src.regions != null && src.regions[0] != null){
                dst.uiIcon = src.regions[0][0];
                dst.fullIcon = src.regions[0][0];
                dst.region = src.regions[0][0];
            }
        }catch(e6){}
        return ok;
    }catch(e){ return false; }
}

function ntVisualReady(block){
    try{
        if(block == null) return false;
        // Conveyor path
        if(block.regions != null && block.regions[0] != null && block.regions[0][0] != null){
            var r = block.regions[0][0];
            if(r.found && r.found()) return true;
            if(r.width > 1) return true;
        }
        // Conduit path
        if(block.topRegions != null && block.topRegions[0] != null) return true;
        if(block.region != null){
            if(block.region.found && block.region.found()) return true;
            if(block.region.width > 1) return true;
        }
        return false;
    }catch(e){ return false; }
}

// Attach upgrade logic to VANILLA build class (keeps sprites 100%).
// This is the reliable path — no tile swap needed for throughput.
function ntAttachVanillaBuildLogic(vanilla, vanillaName){
    if(vanilla == null || vanilla.__ntVanillaLogic) return;
    vanilla.__ntVanillaLogic = true;
    var vname = "" + vanillaName;
    try{
        var prev = vanilla.buildType;
        if(prev == null) return;
        // Detect build class from a temporary instance if possible
        var sample = null;
        try{ sample = prev.get(); }catch(eS){}
        var BuildClass = null;
        try{ if(sample != null) BuildClass = sample.getClass(); }catch(eC){}
        if(BuildClass == null){
            // Fallbacks by type
            try{
                if(typeof Conveyor !== "undefined" && vanilla instanceof Conveyor) BuildClass = Conveyor.ConveyorBuild;
            }catch(e1){}
            try{
                if(BuildClass == null && typeof Conduit !== "undefined" && vanilla instanceof Conduit) BuildClass = Conduit.ConduitBuild;
            }catch(e2){}
            try{
                if(BuildClass == null && typeof Duct !== "undefined" && vanilla instanceof Duct) BuildClass = Duct.DuctBuild;
            }catch(e3){}
        }
        if(BuildClass == null) return;
        vanilla.buildType = function(){
            return extend(BuildClass, {
                updateTile: function(){
                    try{
                        if(Vars.player != null && this.team === Vars.player.team()){
                            var f = globalFactorByBlock[vname];
                            if(f != null && f > 0){
                                this.timeScale = 1 + f;
                                this.timeScaleDuration = 90;
                            }
                        }
                    }catch(eU){}
                    this.super$updateTile();
                }
            });
        };
    }catch(e){
        try{ Log.warn("New Tech's vanilla build logic attach failed for " + vname + ": " + e); }catch(e2){}
    }
}


function ntAttachBuild(block, BuildClass){
    if(block == null || BuildClass == null) return block;
    try{
        block.buildType = function(){
            return extend(BuildClass, {
                updateTile: function(){
                    try{
                        var ts = ntTransportTimeScale(this);
                        if(ts > 1.001){
                            this.timeScale = ts;
                            this.timeScaleDuration = 90;
                        }
                    }catch(eU){}
                    this.super$updateTile();
                }
            });
        };
    }catch(e){
        try{ Log.warn("New Tech's NT buildType attach failed: " + e); }catch(e2){}
    }
    return block;
}

function ntMake(superClass, name, BuildClass, vanillaName){
    if(superClass == null) return null;
    var b = null;
    try{
        b = extend(superClass, name, {
            load: function(){
                this.super$load();
                try{
                    var v = Vars.content.block(vanillaName);
                    if(v != null) ntCopyVisuals(this, v);
                }catch(eL){}
            }
        });
    }catch(e){
        try{ Log.warn("New Tech's NT extend failed for " + name + ": " + e); }catch(e2){}
        return null;
    }
    if(b == null) return null;
    if(BuildClass != null) ntAttachBuild(b, BuildClass);
    return b;
}

var NT_BLOCK_conveyor = ntMake(typeof Conveyor !== "undefined" ? Conveyor : null, "newtech-nt-conveyor", typeof Conveyor !== "undefined" ? Conveyor.ConveyorBuild : null, "conveyor");
var NT_BLOCK_titanium_conveyor = ntMake(typeof Conveyor !== "undefined" ? Conveyor : null, "newtech-nt-titanium-conveyor", typeof Conveyor !== "undefined" ? Conveyor.ConveyorBuild : null, "titanium-conveyor");
var NT_BLOCK_plastanium_conveyor = ntMake(typeof StackConveyor !== "undefined" ? StackConveyor : (typeof Conveyor !== "undefined" ? Conveyor : null), "newtech-nt-plastanium-conveyor", typeof StackConveyor !== "undefined" ? StackConveyor.StackConveyorBuild : (typeof Conveyor !== "undefined" ? Conveyor.ConveyorBuild : null), "plastanium-conveyor");
var NT_BLOCK_armored_conveyor = ntMake(typeof ArmoredConveyor !== "undefined" ? ArmoredConveyor : (typeof Conveyor !== "undefined" ? Conveyor : null), "newtech-nt-armored-conveyor", typeof ArmoredConveyor !== "undefined" ? ArmoredConveyor.ArmoredConveyorBuild : (typeof Conveyor !== "undefined" ? Conveyor.ConveyorBuild : null), "armored-conveyor");
var NT_BLOCK_junction = ntMake(typeof Junction !== "undefined" ? Junction : null, "newtech-nt-junction", typeof Junction !== "undefined" ? Junction.JunctionBuild : null, "junction");
var NT_BLOCK_router = ntMake(typeof Router !== "undefined" ? Router : null, "newtech-nt-router", typeof Router !== "undefined" ? Router.RouterBuild : null, "router");
var NT_BLOCK_distributor = ntMake(typeof Router !== "undefined" ? Router : null, "newtech-nt-distributor", typeof Router !== "undefined" ? Router.RouterBuild : null, "distributor");
var NT_BLOCK_sorter = ntMake(typeof Sorter !== "undefined" ? Sorter : null, "newtech-nt-sorter", typeof Sorter !== "undefined" ? Sorter.SorterBuild : null, "sorter");
var NT_BLOCK_inverted_sorter = ntMake(typeof Sorter !== "undefined" ? Sorter : null, "newtech-nt-inverted-sorter", typeof Sorter !== "undefined" ? Sorter.SorterBuild : null, "inverted-sorter");
var NT_BLOCK_overflow_gate = ntMake(typeof OverflowGate !== "undefined" ? OverflowGate : null, "newtech-nt-overflow-gate", typeof OverflowGate !== "undefined" ? OverflowGate.OverflowGateBuild : null, "overflow-gate");
var NT_BLOCK_underflow_gate = ntMake(typeof OverflowGate !== "undefined" ? OverflowGate : null, "newtech-nt-underflow-gate", typeof OverflowGate !== "undefined" ? OverflowGate.OverflowGateBuild : null, "underflow-gate");
var NT_BLOCK_item_bridge = ntMake(typeof BufferedItemBridge !== "undefined" ? BufferedItemBridge : (typeof ItemBridge !== "undefined" ? ItemBridge : null), "newtech-nt-item-bridge", typeof BufferedItemBridge !== "undefined" ? BufferedItemBridge.BufferedItemBridgeBuild : (typeof ItemBridge !== "undefined" ? ItemBridge.ItemBridgeBuild : null), "item-bridge");
var NT_BLOCK_phase_conveyor = ntMake(typeof ItemBridge !== "undefined" ? ItemBridge : null, "newtech-nt-phase-conveyor", typeof ItemBridge !== "undefined" ? ItemBridge.ItemBridgeBuild : null, "phase-conveyor");
var NT_BLOCK_mass_driver = ntMake(typeof MassDriver !== "undefined" ? MassDriver : null, "newtech-nt-mass-driver", typeof MassDriver !== "undefined" ? MassDriver.MassDriverBuild : null, "mass-driver");
var NT_BLOCK_conduit = ntMake(typeof Conduit !== "undefined" ? Conduit : null, "newtech-nt-conduit", typeof Conduit !== "undefined" ? Conduit.ConduitBuild : null, "conduit");
var NT_BLOCK_pulse_conduit = ntMake(typeof Conduit !== "undefined" ? Conduit : null, "newtech-nt-pulse-conduit", typeof Conduit !== "undefined" ? Conduit.ConduitBuild : null, "pulse-conduit");
var NT_BLOCK_plated_conduit = ntMake(typeof Conduit !== "undefined" ? Conduit : null, "newtech-nt-plated-conduit", typeof Conduit !== "undefined" ? Conduit.ConduitBuild : null, "plated-conduit");
var NT_BLOCK_bridge_conduit = ntMake(typeof LiquidBridge !== "undefined" ? LiquidBridge : null, "newtech-nt-bridge-conduit", typeof LiquidBridge !== "undefined" ? LiquidBridge.LiquidBridgeBuild : null, "bridge-conduit");
var NT_BLOCK_phase_conduit = ntMake(typeof LiquidBridge !== "undefined" ? LiquidBridge : null, "newtech-nt-phase-conduit", typeof LiquidBridge !== "undefined" ? LiquidBridge.LiquidBridgeBuild : null, "phase-conduit");
var NT_BLOCK_liquid_router = ntMake(typeof LiquidRouter !== "undefined" ? LiquidRouter : null, "newtech-nt-liquid-router", typeof LiquidRouter !== "undefined" ? LiquidRouter.LiquidRouterBuild : null, "liquid-router");
var NT_BLOCK_liquid_container = ntMake(typeof LiquidRouter !== "undefined" ? LiquidRouter : null, "newtech-nt-liquid-container", typeof LiquidRouter !== "undefined" ? LiquidRouter.LiquidRouterBuild : null, "liquid-container");
var NT_BLOCK_liquid_tank = ntMake(typeof LiquidRouter !== "undefined" ? LiquidRouter : null, "newtech-nt-liquid-tank", typeof LiquidRouter !== "undefined" ? LiquidRouter.LiquidRouterBuild : null, "liquid-tank");
var NT_BLOCK_duct = ntMake(typeof Duct !== "undefined" ? Duct : null, "newtech-nt-duct", typeof Duct !== "undefined" ? Duct.DuctBuild : null, "duct");
var NT_BLOCK_armored_duct = ntMake(typeof Duct !== "undefined" ? Duct : null, "newtech-nt-armored-duct", typeof Duct !== "undefined" ? Duct.DuctBuild : null, "armored-duct");
var NT_BLOCK_duct_router = ntMake(typeof DuctRouter !== "undefined" ? DuctRouter : null, "newtech-nt-duct-router", typeof DuctRouter !== "undefined" ? DuctRouter.DuctRouterBuild : null, "duct-router");
var NT_BLOCK_duct_bridge = ntMake(typeof DuctBridge !== "undefined" ? DuctBridge : null, "newtech-nt-duct-bridge", typeof DuctBridge !== "undefined" ? DuctBridge.DuctBridgeBuild : null, "duct-bridge");
var NT_BLOCK_duct_unloader = ntMake(typeof DirectionalUnloader !== "undefined" ? DirectionalUnloader : null, "newtech-nt-duct-unloader", typeof DirectionalUnloader !== "undefined" ? DirectionalUnloader.DirectionalUnloaderBuild : null, "duct-unloader");
var NT_BLOCK_reinforced_conduit = ntMake(typeof Conduit !== "undefined" ? Conduit : null, "newtech-nt-reinforced-conduit", typeof Conduit !== "undefined" ? Conduit.ConduitBuild : null, "reinforced-conduit");
var NT_BLOCK_reinforced_liquid_router = ntMake(typeof LiquidRouter !== "undefined" ? LiquidRouter : null, "newtech-nt-reinforced-liquid-router", typeof LiquidRouter !== "undefined" ? LiquidRouter.LiquidRouterBuild : null, "reinforced-liquid-router");
var NT_BLOCK_reinforced_liquid_container = ntMake(typeof LiquidRouter !== "undefined" ? LiquidRouter : null, "newtech-nt-reinforced-liquid-container", typeof LiquidRouter !== "undefined" ? LiquidRouter.LiquidRouterBuild : null, "reinforced-liquid-container");
var NT_BLOCK_reinforced_liquid_tank = ntMake(typeof LiquidRouter !== "undefined" ? LiquidRouter : null, "newtech-nt-reinforced-liquid-tank", typeof LiquidRouter !== "undefined" ? LiquidRouter.LiquidRouterBuild : null, "reinforced-liquid-tank");
var NT_BLOCK_reinforced_bridge_conduit = ntMake(typeof LiquidBridge !== "undefined" ? LiquidBridge : null, "newtech-nt-reinforced-bridge-conduit", typeof LiquidBridge !== "undefined" ? LiquidBridge.LiquidBridgeBuild : null, "reinforced-bridge-conduit");





function tryResearchNow(u){
    if(u == null) return false;
    var lv = levelOf(u.id);
    if(lv >= u.max) return true;
    var cores = researchCores();
    if(cores.length === 0) return false;
    var rem = remainingCost(u);
    var ok = false;
    if(rem.length === 0){
        setLevel(u.id, lv + 1);
        clearPartial(u.id);
        ok = true;
    }else if(canFull(cores, rem)){
        payStacks(cores, rem);
        setLevel(u.id, lv + 1);
        clearPartial(u.id);
        ok = true;
    }else if(hasAny(cores, rem)){
        ok = contributeResearch(u);
    }
    if(ok){
        try{
            var b = u.block != null ? u.block() : null;
            if(b != null){
                var g = BLOCK_GROUPS[""+b.name];
                if(g != null) ensureComboMastery(g);
            }
        }catch(eC){}
    }
    return ok;
}

function lang(){ return Core.settings.getString(LANG_KEY, "en"); }
// en, pt, es, vi — missing langs fall back to English
function tr(en, pt, es, vi){
    var l = lang();
    if(l === "pt" && pt != null && pt !== "") return pt;
    if(l === "es" && es != null && es !== "") return es;
    if(l === "vi" && vi != null && vi !== "") return vi;
    // soft fallbacks
    if(l === "es" && pt != null && pt !== "") return pt;
    return en;
}
function L(map){
    // map: {en, pt, es, vi}
    if(map == null) return "";
    return tr(map.en || "", map.pt || map.en || "", map.es || map.en || "", map.vi || map.en || "");
}
function isCampaign(){ return Vars.state != null && Vars.state.isCampaign(); }
function isPvp(){
    try{ return Vars.state != null && Vars.state.rules != null && Vars.state.rules.pvp; }catch(e){ return false; }
}
function isSandbox(){
    try{ return Vars.state != null && Vars.state.rules != null && Vars.state.rules.infiniteResources; }catch(e){ return false; }
}
function isEditorMode(){
    try{ return Vars.state != null && Vars.state.rules != null && Vars.state.rules.editor; }catch(e){ return false; }
}
function isWorldAuthority(){
    try{
        if(Vars.net == null || !Vars.net.active()) return true;
        if(Vars.net.server()) return true;
        return false;
    }catch(e){ return true; }
}
function shopUsesHostRelay(){
    try{
        if(isWorldAuthority()) return false;
        return Vars.net != null && Vars.net.client();
    }catch(e){ return false; }
}
function modeAllowsFreeShopUi(){
    return isPvp() || isSandbox() || isEditorMode();
}

function safePart(s){
    if(s == null) return "unknown";
    return (""+s).toLowerCase().replace(/[^a-z0-9_-]+/g, "_").substring(0, 90);
}
function blockSeed(name){
    var s = 0, str = "" + name;
    for(var i = 0; i < str.length; i++) s = (s * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(s);
}
function rangeCount(seed, min, max){
    return min + (seed % (max - min + 1));
}

function currentTeamId(){
    try{
        if(Vars.player != null){
            var t = Vars.player.team();
            if(t != null) return t.id|0;
        }
    }catch(e){}
    try{
        if(Vars.state != null && Vars.state.rules != null && Vars.state.rules.defaultTeam != null){
            return Vars.state.rules.defaultTeam.id|0;
        }
    }catch(e2){}
    return 1;
}

function mapIdentity(){
    try{
        var m = Vars.state.map;
        if(m != null){
            if(m.file != null){
                try{ return "file-" + m.file.nameWithoutExtension(); }catch(e){}
            }
            try{
                if(m.name != null){
                    if(typeof m.name === "function") return "name-" + m.name();
                    return "name-" + m.name;
                }
            }catch(e2){}
            try{ return "map-" + m.toString(); }catch(e3){}
        }
    }catch(e4){}
    return "unknown-map";
}

function campaignIdentity(){
    try{
        if(Vars.state != null && Vars.state.getPlanet != null){
            var p = Vars.state.getPlanet();
            if(p != null){
                if(p.name != null) return "planet-" + p.name;
                try{ return "planet-" + p.localizedName; }catch(e){}
            }
        }
    }catch(e2){}
    try{
        if(Vars.state != null && Vars.state.rules != null && Vars.state.rules.planet != null){
            var rp = Vars.state.rules.planet;
            if(rp.name != null) return "planet-" + rp.name;
            try{ return "planet-" + rp.localizedName; }catch(e3){}
        }
    }catch(e4){}
    return "campaign";
}

function modeIdentity(){
    try{
        var r = Vars.state.rules;
        var mode = r.pvp ? "pvp" : (r.editor ? "editor" : (r.attackMode ? "attack" : (r.infiniteResources ? "sandbox" : "survival")));
        var custom = r.modeName == null ? "" : ("-" + r.modeName);
        return mode + custom;
    }catch(e){ return "custom"; }
}

function saveSessionId(){
    // Stable id for this save (not map name). Survives re-enter of the same save.
    try{
        if(Vars.state == null || Vars.state.rules == null || Vars.state.rules.tags == null) return "nosave";
        var tags = Vars.state.rules.tags;
        var id = null;
        try{ id = tags.get("newtechs-save-id", null); }catch(e0){ id = tags.get("newtechs-save-id"); }
        if(id == null || (""+id).length === 0){
            id = "s" + (Time.millis()|0) + "-" + ((Math.random()*1e9)|0);
            try{ tags.put("newtechs-save-id", ""+id); }catch(e1){}
        }
        return ""+id;
    }catch(e){ return "nosave"; }
}

function stateStoreKey(){
    if(Vars.state == null || !Vars.state.isGame()) return null;
    var team = currentTeamId();
    if(isCampaign()) return SAVE_PREFIX + "campaign-" + safePart(campaignIdentity()) + "-team-" + team;
    // Custom / PvP: per save file + team (not per map name)
    return SAVE_PREFIX + "save-" + safePart(saveSessionId()) + "-team-" + team;
}

function stateTagKey(){
    if(Vars.state == null || Vars.state.rules == null) return null;
    var team = currentTeamId();
    if(isCampaign()) return SAVE_TAG_PREFIX + "campaign-team-" + team;
    return SAVE_TAG_PREFIX + "custom-team-" + team;
}

function parseStore(text){
    if(text == null || (""+text).length === 0) return null;
    try{
        var data = JSON.parse(""+text);
        if(data == null || typeof data !== "object") return null;
        if(data.levels == null) data.levels = {};
        if(data.partial == null) data.partial = {};
        if(data.missions == null) data.missions = {};
        if(data.points == null) data.points = 0;
        if(data.shop == null) data.shop = null;
        if(data.pointMissions == null) data.pointMissions = null;
        return data;
    }catch(e){ return null; }
}

function loadLegacyCampaignStore(){
    var data = {levels:{}, partial:{}};
    var found = false;
    var ids = Object.keys(UPGRADES);
    for(var i = 0; i < ids.length; i++){
        var id = ids[i];
        var lv = Core.settings.getInt(PREFIX + id, 0);
        if(lv > 0){ data.levels[id] = lv; found = true; }
        var ps = Core.settings.getString(PARTIAL + id, "");
        if(ps){
            try{ data.partial[id] = JSON.parse(ps); found = true; }catch(e){}
        }
    }
    return found ? data : null;
}

function loadPersistentState(){
    var key = stateStoreKey();
    if(key == null){
        activeStoreKey = null;
        activeTagKey = null;
        persistentLevels = {};
        persistentPartial = {};
        persistentMissions = {};
        persistentPoints = 0;
        persistentShop = null;
        persistentPointMissions = null;
        return;
    }
    var tagKey = stateTagKey();
    if(activeStoreKey === key && activeTagKey === tagKey) return;

    var data = null;
    var tagData = null;
    try{
        var tags = Vars.state.rules.tags;
        if(tags != null && tagKey != null){
            tagData = parseStore(tags.get(tagKey));
        }
    }catch(e){}

    // Campaign research is persistent for the planet/team, so prefer the local campaign store
    // and only use save tags as an additional source. Custom games prefer the save tag itself.
    if(isCampaign()){
        data = parseStore(Core.settings.getString(key, ""));
        if(data == null) data = loadLegacyCampaignStore();
        if(data == null) data = {levels:{}, partial:{}};
        if(tagData != null){
            var tagIds = Object.keys(tagData.levels || {});
            for(var ti = 0; ti < tagIds.length; ti++){
                var tid = tagIds[ti];
                var tv = tagData.levels[tid]|0;
                if((data.levels[tid]|0) < tv) data.levels[tid] = tv;
            }
            if(tagData.partial != null){
                var tagParts = Object.keys(tagData.partial);
                for(var tp = 0; tp < tagParts.length; tp++){
                    var tpid = tagParts[tp];
                    if(data.partial[tpid] == null) data.partial[tpid] = tagData.partial[tpid];
                }
            }
        }
    }else{
        data = tagData;
        if(data == null) data = parseStore(Core.settings.getString(key, ""));
        if(data == null) data = {levels:{}, partial:{}};
    }

    activeStoreKey = key;
    activeTagKey = tagKey;
    persistentLevels = data.levels;
            if(data.missions != null) persistentMissions = data.missions; else persistentMissions = {};
            if(data.points != null) persistentPoints = data.points|0;
            if(data.shop !== undefined) persistentShop = data.shop;
            if(data.pointMissions !== undefined) persistentPointMissions = data.pointMissions || {};
    persistentPartial = data.partial || {};

    // Keep the current save/settings copy synchronized after loading.
    savePersistentState(false);
}

function savePersistentState(flush){
    if(activeStoreKey == null) return;
    var data = JSON.stringify({version:2, levels:persistentLevels, partial:persistentPartial, missions:persistentMissions||{}, points:persistentPoints|0, shop:persistentShop, pointMissions:persistentPointMissions});
    try{ Core.settings.put(activeStoreKey, data); }catch(e){}
    try{
        if(Vars.state != null && Vars.state.rules != null && Vars.state.rules.tags != null && activeTagKey != null){
            Vars.state.rules.tags.put(activeTagKey, data);
        }
    }catch(e2){}
    if(flush){
        try{ Core.settings.manualSave(); }catch(e3){}
    }
}

function ensurePersistentState(){
    var key = stateStoreKey();
    var tag = stateTagKey();
    if(key !== activeStoreKey || tag !== activeTagKey) loadPersistentState();
}

function levelOf(id){
    ensurePersistentState();
    var v = persistentLevels[id];
    return v == null ? 0 : (v|0);
}
function setLevel(id, lv){
    ensurePersistentState();
    var prev = persistentLevels[id]|0;
    persistentLevels[id] = lv|0;
    savePersistentState(false); // memory only — never manualSave on click
    var u = UPGRADES[id] != null ? UPGRADES[id] : MASTER_UPGRADES[id];
    var isBullet = u != null && u.bulletKind != null;
    var isMaster = u != null && MASTER_UPGRADES[id] != null;

    // Lightweight paths first — never rebuild whole catalog on a single click
    if(isBullet){
        // Only the affected block/unit, deferred
        try{ Core.app.post(function(){ try{ applyAllBulletUpgrades(); }catch(eB){} }); }catch(ePostB){}
    }else if(isMaster){
        try{ masterActivationKey = null; activateResearchedMasters(); masterActivationKey = stateStoreKey(); }catch(e2){}
    }else{
        // Ordinary core/conditional: just ranks, no master/ammo/bullet scans
        try{ if(catalogBuilt) refreshGlobalBoostRanks(); }catch(e){}
    }

    if(lv > prev){
        try{
            var bname = "?";
            try{ if(u != null && u.block != null) bname = u.block().localizedName; }catch(e4){}
            pushHistory({
                action: tr("Researched", "Pesquisou") + " → " + (u != null ? upgradeDisplayName(u) : id),
                block: bname,
                pos: null,
                detail: tr("Rank ", "Nível ") + lv
            });
        }catch(eH){}
        // Network/tag sync deferred so the click stays snappy
        try{
            Core.app.post(function(){
                try{
                    if(Vars.net != null && Vars.net.active()) broadcastSync();
                    else writeHostTags();
                }catch(eS){}
            });
        }catch(ePostS){}
    }
}

function getPartial(id){
    ensurePersistentState();
    return persistentPartial[id] == null ? {} : persistentPartial[id];
}
function setPartial(id, obj){
    ensurePersistentState();
    persistentPartial[id] = obj;
    savePersistentState(false);
}
function clearPartial(id){ setPartial(id, {}); }
function paidFor(id, item){
    var p = getPartial(id);
    return p[item.name] == null ? 0 : p[item.name];
}

function remainingCost(u){
    var lv = levelOf(u.id);
    if(lv >= u.max) return [];
    var full = u.cost(lv + 1);
    var out = [];
    for(var i = 0; i < full.length; i++){
        var it = full[i][0];
        var left = full[i][1] - paidFor(u.id, it);
        if(left > 0) out.push([it, left]);
    }
    return out;
}

function installCost(u, lv){
    var base = u.cost(Math.max(1, lv));
    var out = [];
    for(var i = 0; i < base.length; i++){
        out.push([base[i][0], Math.max(1, Math.floor(base[i][1] * 0.35))]);
    }
    return out;
}

function bkey(b){ return b.tile.x + "," + b.tile.y; }
function getApplied(b, id){
    var m = appliedMap[bkey(b)];
    if(m == null) return 0;
    return m[id] == null ? 0 : m[id];
}
function addCachedBoostTarget(build){
    if(build == null || !build.isValid()) return;
    var key = null;
    try{ key = bkey(build); }catch(e){ return; }
    if(cachedBoostTargetKeys[key]) return;
    cachedBoostTargetKeys[key] = true;
    cachedBoostTargets.push(build);
}

function setApplied(b, id, lv){
    var k = bkey(b);
    if(appliedMap[k] == null) appliedMap[k] = {};
    appliedMap[k][id] = lv;
    anyBoostActive = true;
    // The just-installed building is already known; add it directly instead of
    // forcing a whole-map Groups.build scan on the click that installed it.
    addCachedBoostTarget(b);
    lastBoostTick = -1000;
    try{
        var u = UPGRADES[id];
        pushHistory({
            action: tr("Installed", "Instalou") + " → " + (u != null ? upgradeDisplayName(u) : id),
            block: b.block.localizedName,
            pos: b.tile.x + "," + b.tile.y,
            detail: tr("Install rank ", "Nível instalado ") + lv
        });
    }catch(e){}
}
function maxAppliedBoost(b){
    var m = appliedMap[bkey(b)];
    if(m == null) return 0;
    var best = 0;
    var ids = Object.keys(m);
    for(var i = 0; i < ids.length; i++){
        if(m[ids[i]] > best) best = m[ids[i]];
    }
    return best;
}


function upgradeDisplayName(u){
    if(u == null) return "?";
    try{ if(typeof u.name === "function") return u.name(); }catch(e){}
    try{ return tr(u.nameEn || u.id || "?", u.namePt || u.nameEn || u.id || "?"); }catch(e2){}
    try{ return "" + (u.id || "?"); }catch(e3){}
    return "?";
}
function upgradeDisplayDesc(u, lv){
    if(u == null) return "";
    try{ if(typeof u.desc === "function") return u.desc(lv != null ? lv : 1); }catch(e){}
    try{ return tr(u.descEn || "", u.descPt || u.descEn || ""); }catch(e2){}
    return "";
}
function makeUp(id, blockFn, max, costFn, nameEn, namePt, descEn, descPt, keys, nameEs, nameVi, descEs, descVi){
    return {
        id: id,
        block: blockFn,
        max: max,
        cost: costFn,
        nameEn: nameEn,
        namePt: namePt,
        nameEs: nameEs || nameEn,
        nameVi: nameVi || nameEn,
        descEn: descEn,
        descPt: descPt,
        descEs: descEs || descEn,
        descVi: descVi || descEn,
        keys: keys,
        name: function(){ return tr(this.nameEn, this.namePt, this.nameEs, this.nameVi); },
        desc: function(lv){
            var a = (""+this.descEn).split("%l").join("" + lv);
            var b = (""+this.descPt).split("%l").join("" + lv);
            var c = (""+this.descEs).split("%l").join("" + lv);
            var d = (""+this.descVi).split("%l").join("" + lv);
            return tr(a, b, c, d);
        }
    };
}

function developerNote(u){
    if(u == null) return null;
    var id = "" + (u.id || "");
    var notes = {
        "mech-speed": {en:"DEV NOTE: I have absolutely no idea what I am doing 0-0", pt:"NOTA DO DEV: Não faço ideia do que estou fazendo 0-0"},
        "pneu-boost": {en:"DEV NOTE: Water makes everything better. Probably.", pt:"NOTA DO DEV: Água melhora tudo. Provavelmente."},
        "duo-reload": {en:"DEV NOTE: More bullets = more science. Trust me.", pt:"NOTA DO DEV: Mais balas = mais ciência. Confia."},
        "duo-range": {en:"DEV NOTE: I made the barrel longer. That counts as engineering.", pt:"NOTA DO DEV: Eu deixei o cano maior. Isso conta como engenharia."},
        "arc-power": {en:"DEV NOTE: Please do not touch this while wet.", pt:"NOTA DO DEV: Por favor, não mexa nisso molhado."},
        "water-pump": {en:"DEV NOTE: It is just a bigger hole. Very advanced technology.", pt:"NOTA DO DEV: É só um buraco maior. Tecnologia muito avançada."},
        "master-duo-1": {en:"DEV NOTE: Yes, the Duo now eats metaglass. I regret nothing.", pt:"NOTA DO DEV: Sim, o Duo agora come metaglass. Não me arrependo de nada."},
        "master-scorch-1": {en:"DEV NOTE: Flying enemies were getting too comfortable.", pt:"NOTA DO DEV: Os inimigos voadores estavam confortáveis demais."},
        "master-arc-1": {en:"DEV NOTE: Electricity is basically just spicy water.", pt:"NOTA DO DEV: Eletricidade é basicamente água apimentada."},
        "master-scatter-2": {en:"DEV NOTE: I improved the aim. Somehow it is still terrifying.", pt:"NOTA DO DEV: Eu melhorei a mira. De algum jeito ainda é assustador."},
        "master-hail-1": {en:"DEV NOTE: If it can reach that far, it is probably fine.", pt:"NOTA DO DEV: Se consegue chegar tão longe, provavelmente está tudo bem."},
        "master-salvo-1": {en:"DEV NOTE: Four bullets were not enough. Apparently.", pt:"NOTA DO DEV: Quatro balas não eram suficientes. Aparentemente."},
        "master-lancer-3": {en:"DEV NOTE: More charging. More waiting. Perfect.", pt:"NOTA DO DEV: Mais carga. Mais espera. Perfeito."},
        "master-mechanical-drill-1": {en:"DEV NOTE: I made the drill angrier.", pt:"NOTA DO DEV: Eu deixei a broca mais brava."},
        "master-pneumatic-drill-1": {en:"DEV NOTE: Pressure solves everything until it doesn't.", pt:"NOTA DO DEV: Pressão resolve tudo até não resolver."},
        "master-router-1": {en:"DEV NOTE: I call this organized chaos.", pt:"NOTA DO DEV: Eu chamo isso de caos organizado."},
        "master-junction-1": {en:"DEV NOTE: Now the spaghetti has a degree in logistics.", pt:"NOTA DO DEV: Agora o espaguete tem diploma em logística."},
        "master-copper-wall-1": {en:"DEV NOTE: It is still a wall. Just a suspiciously good one.", pt:"NOTA DO DEV: Ainda é uma parede. Só que suspeitosamente boa."},
        "master-duo-2": {en:"DEV NOTE: Yes, I gave the Duo more buttons. No, I will not explain.", pt:"NOTA DO DEV: Sim, eu dei mais botões para o Duo. Não, não vou explicar."},
        "master-scorch-2": {en:"DEV NOTE: The range was short, so I simply declared it longer.", pt:"NOTA DO DEV: O alcance era curto, então eu simplesmente declarei que era maior."},
        "master-arc-2": {en:"DEV NOTE: Please ignore the suspicious amount of electricity.", pt:"NOTA DO DEV: Ignore a quantidade suspeita de eletricidade."}
    };
        if(notes[id] != null) return notes[id];
    // Funny fallback notes so every card has something
    var pool = [
        {en:"DEV NOTE: I don't know what I am doing.", pt:"NOTA DO DEV: Não sei o que estou fazendo."},
        {en:"DEV NOTE: It compiled. Ship it.", pt:"NOTA DO DEV: Compilou. Pode ir."},
        {en:"DEV NOTE: Balance is a social construct.", pt:"NOTA DO DEV: Balanceamento é construção social."},
        {en:"DEV NOTE: Please do not ask how this works.", pt:"NOTA DO DEV: Por favor não pergunte como isso funciona."},
        {en:"DEV NOTE: Science means bigger numbers.", pt:"NOTA DO DEV: Ciência significa números maiores."},
        {en:"DEV NOTE: I pressed buttons until it looked cool.", pt:"NOTA DO DEV: Apertei botões até ficar legal."},
        {en:"DEV NOTE: If it breaks, it was a feature.", pt:"NOTA DO DEV: Se quebrar, era feature."},
        {en:"DEV NOTE: Sleep is for people without mods.", pt:"NOTA DO DEV: Dormir é para quem não tem mods."},
        {en:"DEV NOTE: Yes, this is intentional. Probably.", pt:"NOTA DO DEV: Sim, isso é intencional. Provavelmente."},
        {en:"DEV NOTE: More cards = more power. Trust me.", pt:"NOTA DO DEV: Mais cards = mais poder. Confia."},
        {en:"DEV NOTE: This one passed the extremely scientific coffee test.", pt:"NOTA DO DEV: Esse passou no teste extremamente científico do café."},
        {en:"DEV NOTE: I added this because the turret looked bored.", pt:"NOTA DO DEV: Adicionei isso porque a torreta parecia entediada."},
        {en:"DEV NOTE: Six ammo options sounded reasonable at 3 AM.", pt:"NOTA DO DEV: Seis opções de munição pareceram razoáveis às 3 da manhã."},
        {en:"DEV NOTE: The spreadsheet said yes. The spreadsheet is in charge now.", pt:"NOTA DO DEV: A planilha disse sim. A planilha manda agora."},
        {en:"DEV NOTE: Unit balance meeting postponed indefinitely.", pt:"NOTA DO DEV: Reunião de balanceamento das unidades adiada indefinidamente."},
        {en:"DEV NOTE: If the unit is still weak, add more engineering.", pt:"NOTA DO DEV: Se a unidade ainda estiver fraca, adicione mais engenharia."},
        {en:"DEV NOTE: This projectile has a degree in being useful.", pt:"NOTA DO DEV: Esse projétil tem diploma em ser útil."},
        {en:"DEV NOTE: I definitely tested this. Probably.", pt:"NOTA DO DEV: Eu definitivamente testei isso. Provavelmente."},
        {en:"DEV NOTE: No turrets were emotionally harmed during testing.", pt:"NOTA DO DEV: Nenhuma torreta sofreu danos emocionais durante os testes."},
        {en:"DEV NOTE: If the numbers look scary, they are working.", pt:"NOTA DO DEV: Se os números parecem assustadores, está funcionando."},
        {en:"DEV NOTE: Ammo is now doing something besides sitting in storage.", pt:"NOTA DO DEV: A munição agora faz algo além de ficar parada no armazenamento."},
        {en:"DEV NOTE: I called this balanced and nobody stopped me.", pt:"NOTA DO DEV: Eu chamei isso de balanceado e ninguém me impediu."},
        {en:"DEV NOTE: Research first, questions later.", pt:"NOTA DO DEV: Pesquisa primeiro, perguntas depois."},
        {en:"DEV NOTE: The turret asked for options. I gave it too many.", pt:"NOTA DO DEV: A torreta pediu opções. Eu dei opções demais."},
        {en:"DEV NOTE: This is what happens when optimization gets bored.", pt:"NOTA DO DEV: É isso que acontece quando a otimização fica entediada."}
    ];
    var pick = blockSeed(id) % pool.length;
    return pool[pick];
}

function makeGlobalUp(id, blockFn, max, costFn, nameEn, namePt, descEn, descPt, keys, globalKind){
    var u = makeUp(id, blockFn, max, costFn, nameEn, namePt, descEn, descPt, keys);
    u.globalResearch = true;
    u.globalKind = globalKind;
    return u;
}

var UPGRADES = {
    "mech-speed": makeUp("mech-speed", function(){ return Blocks.mechanicalDrill; }, 3,
        function(lv){ return [[Items.copper, 120+lv*80],[Items.lead,40+lv*40]]; },
        "Hardened Bits", "Brocas Endurecidas",
        "Mining speed (rank %l/3).", "Velocidade de mineracao (rank %l/3).",
        "mech mechanical drill broca mecanica speed velocidade bits"),
    "mech-cap": makeUp("mech-cap", function(){ return Blocks.mechanicalDrill; }, 2,
        function(lv){ return [[Items.copper,100+lv*60],[Items.lead,60+lv*40]]; },
        "Larger Hopper", "Hopper Ampliado",
        "Capacity rank %l/2.", "Capacidade rank %l/2.",
        "mech mechanical drill broca mecanica hopper capacity capacidade"),
    "pneu-speed": makeUp("pneu-speed", function(){ return Blocks.pneumaticDrill; }, 3,
        function(lv){ return [[Items.copper,180+lv*100],[Items.graphite,60+lv*40]]; },
        "High Pressure", "Alta Pressao",
        "Mining speed rank %l/3.", "Velocidade rank %l/3.",
        "pneu pneumatic drill broca pneumatica speed pressao"),
    "pneu-boost": makeUp("pneu-boost", function(){ return Blocks.pneumaticDrill; }, 2,
        function(lv){ return [[Items.graphite,80+lv*50],[Items.titanium,40+lv*30]]; },
        "Coolant Jets", "Jatos de Refrigerante",
        "Water boost rank %l/2.", "Boost de agua rank %l/2.",
        "pneu pneumatic water agua boost coolant"),
    "laser-speed": makeUp("laser-speed", function(){ return Blocks.laserDrill; }, 3,
        function(lv){ return [[Items.silicon,80+lv*60],[Items.titanium,60+lv*40],[Items.graphite,50+lv*30]]; },
        "Focused Beam", "Feixe Focado",
        "Mining speed rank %l/3.", "Velocidade rank %l/3.",
        "laser drill broca feixe beam speed"),
    "laser-optics": makeUp("laser-optics", function(){ return Blocks.laserDrill; }, 2,
        function(lv){ return [[Items.silicon,100+lv*70],[Items.titanium,50+lv*40]]; },
        "Efficient Optics", "Optica Eficiente",
        "Hard ore rank %l/2.", "Minerio duro rank %l/2.",
        "laser optics optica"),
    "laser-cap": makeUp("laser-cap", function(){ return Blocks.laserDrill; }, 2,
        function(lv){ return [[Items.titanium,70+lv*50],[Items.graphite,60+lv*40]]; },
        "Storage Bay", "Baia de Armazenamento",
        "Capacity rank %l/2.", "Capacidade rank %l/2.",
        "laser storage capacity capacidade"),
    "blast-speed": makeUp("blast-speed", function(){ return Blocks.blastDrill; }, 3,
        function(lv){ return [[Items.titanium,100+lv*70],[Items.thorium,80+lv*50],[Items.silicon,70+lv*40]]; },
        "Overdriven Fans", "Ventiladores Sobrecarregados",
        "Mining speed rank %l/3.", "Velocidade rank %l/3.",
        "blast airblast drill broca ar speed"),
    "blast-boost": makeUp("blast-boost", function(){ return Blocks.blastDrill; }, 2,
        function(lv){ return [[Items.thorium,90+lv*60],[Items.titanium,80+lv*50]]; },
        "Cryo Injection", "Injecao Criogenica",
        "Liquid boost rank %l/2.", "Boost liquido rank %l/2.",
        "blast airblast cryo boost"),
    "blast-cap": makeUp("blast-cap", function(){ return Blocks.blastDrill; }, 2,
        function(lv){ return [[Items.thorium,70+lv*50],[Items.silicon,60+lv*40]]; },
        "Bulk Hopper", "Hopper em Massa",
        "Capacity rank %l/2.", "Capacidade rank %l/2.",
        "blast airblast capacity capacidade hopper"),
    "water-pump": makeUp("water-pump", function(){ return Blocks.waterExtractor; }, 3,
        function(lv){ return [[Items.copper,100+lv*70],[Items.lead,80+lv*50],[Items.graphite,40+lv*30]]; },
        "Deep Bore", "Perfuracao Profunda",
        "Pump rate rank %l/3.", "Bombeamento rank %l/3.",
        "water extractor extrator agua pump"),
    "water-eff": makeUp("water-eff", function(){ return Blocks.waterExtractor; }, 2,
        function(lv){ return [[Items.metaglass,50+lv*40],[Items.graphite,40+lv*30]]; },
        "Reservoir Tank", "Tanque Reservatorio",
        "Liquid capacity rank %l/2.", "Capacidade liquido rank %l/2.",
        "water extractor capacity tanque"),
    "cult-speed": makeUp("cult-speed", function(){ return Blocks.cultivator; }, 3,
        function(lv){ return [[Items.copper,80+lv*50],[Items.lead,60+lv*40],[Items.silicon,30+lv*25]]; },
        "Fertile Soil", "Solo Fertil",
        "Production rank %l/3.", "Producao rank %l/3.",
        "cultivator cultivador spore"),
    "cult-eff": makeUp("cult-eff", function(){ return Blocks.cultivator; }, 2,
        function(lv){ return [[Items.silicon,50+lv*40],[Items.titanium,30+lv*25]]; },
        "Spore Bins", "Silos de Esporos",
        "Capacity rank %l/2.", "Capacidade rank %l/2.",
        "cultivator capacity silo"),
    "oil-speed": makeUp("oil-speed", function(){ return Blocks.oilExtractor; }, 3,
        function(lv){ return [[Items.copper,150+lv*80],[Items.graphite,80+lv*50],[Items.thorium,40+lv*30]]; },
        "High Flow Valves", "Valvulas de Alto Fluxo",
        "Extraction rank %l/3.", "Extracao rank %l/3.",
        "oil extractor extrator oleo oil"),
    "oil-eff": makeUp("oil-eff", function(){ return Blocks.oilExtractor; }, 2,
        function(lv){ return [[Items.titanium,60+lv*40],[Items.silicon,50+lv*35]]; },
        "Crude Storage", "Armazenamento de Bruto",
        "Liquid capacity rank %l/2.", "Capacidade liquido rank %l/2.",
        "oil extractor capacity"),
    "duo-reload": makeUp("duo-reload", function(){ return Blocks.duo; }, 3,
        function(lv){ return [[Items.copper,80+lv*50],[Items.lead,60+lv*40]]; },
        "Servo Motors", "Motores Servo",
        "Fire rate rank %l/3.", "Cadencia rank %l/3.",
        "duo turret torre reload fire rate cadencia"),
    "duo-range": makeUp("duo-range", function(){ return Blocks.duo; }, 2,
        function(lv){ return [[Items.copper,100+lv*60],[Items.graphite,40+lv*30]]; },
        "Long Barrels", "Canos Longos",
        "Range rank %l/2.", "Alcance rank %l/2.",
        "duo range alcance barrel"),
    "arc-power": makeUp("arc-power", function(){ return Blocks.arc; }, 3,
        function(lv){ return [[Items.lead,100+lv*60],[Items.copper,80+lv*50],[Items.silicon,50+lv*40]]; },
        "High Voltage", "Alta Tensao",
        "Damage rank %l/3.", "Dano rank %l/3.",
        "arc turret torre lightning raio damage dano voltage"),
    "arc-range": makeUp("arc-range", function(){ return Blocks.arc; }, 2,
        function(lv){ return [[Items.lead,80+lv*50],[Items.silicon,40+lv*30]]; },
        "Coil Extension", "Extensao de Bobina",
        "Range rank %l/2.", "Alcance rank %l/2.",
        "arc range alcance coil bobina")
};

var GROUPS = [
    { titleEn: "Mechanical Drill", titlePt: "Broca Mecanica", block: function(){ return Blocks.mechanicalDrill; }, upgrades: ["mech-speed","mech-cap"], isDrillGroup: true, planet: "shared" },
    { titleEn: "Pneumatic Drill", titlePt: "Broca Pneumatica", block: function(){ return Blocks.pneumaticDrill; }, upgrades: ["pneu-speed","pneu-boost"], isDrillGroup: true, planet: "shared" },
    { titleEn: "Laser Drill", titlePt: "Broca a Laser", block: function(){ return Blocks.laserDrill; }, upgrades: ["laser-speed","laser-optics","laser-cap"], isDrillGroup: true, planet: "shared" },
    { titleEn: "Airblast Drill", titlePt: "Broca de Ar", block: function(){ return Blocks.blastDrill; }, upgrades: ["blast-speed","blast-boost","blast-cap"], isDrillGroup: true, planet: "shared" },
    { titleEn: "Water Extractor", titlePt: "Extrator de Agua", block: function(){ return Blocks.waterExtractor; }, upgrades: ["water-pump","water-eff"], planet: "serpulo" },
    { titleEn: "Cultivator", titlePt: "Cultivador", block: function(){ return Blocks.cultivator; }, upgrades: ["cult-speed","cult-eff"], planet: "serpulo" },
    { titleEn: "Oil Extractor", titlePt: "Extrator de Oleo", block: function(){ return Blocks.oilExtractor; }, upgrades: ["oil-speed","oil-eff"], planet: "serpulo" },
    { titleEn: "Duo", titlePt: "Duo", block: function(){ return Blocks.duo; }, upgrades: ["duo-reload","duo-range"], planet: "serpulo" },
    { titleEn: "Arc", titlePt: "Arc", block: function(){ return Blocks.arc; }, upgrades: ["arc-power","arc-range"], planet: "serpulo" }
];

function autoCost(blockFn, idx, lv){
    var b = blockFn();
    var req = b != null ? b.requirements : null;
    if(req == null || req.length === 0) return [[Items.copper, 100 + idx * 40 + lv * 50]];

    var out = [];
    var take = Math.min(3, req.length);
    for(var i = 0; i < take; i++){
        var r = req[(i + idx) % req.length];
        if(r != null && r.item != null){
            var mult = 0.55 + idx * 0.12;
            var amt = Math.max(20, Math.floor(r.amount * mult) + lv * (15 + idx * 5));
            out.push([r.item, amt]);
        }
    }
    return out;
}

var CATEGORY_ORDER = [
    "production", "crafting", "turret", "liquid", "defense", "power", "effect", "unit", "logic"
];
var BULLET_CATEGORY = "bullet";
var CATEGORY_LABELS_EN = {
    distribution: "DISTRIBUTION",
    production: "PRODUCTION",
    crafting: "CRAFTING",
    turret: "TURRET",
    bullet: "BULLET UPGRADE",
    liquid: "LIQUID",
    defense: "DEFENSE",
    power: "ENERGY",
    effect: "EFFECT",
    unit: "UNIT",
    logic: "LOGIC"
};
var CATEGORY_LABELS_PT = {
    distribution: "Distribuição",
    production: "Produção",
    crafting: "Crafting",
    turret: "Torreta",
    bullet: "Upgrade de Tiro",
    liquid: "Líquido",
    defense: "Defesa",
    power: "Energia",
    effect: "Efeito",
    unit: "Unidade",
    logic: "Lógica"
};
var CATEGORY_LABELS_ES = {
    distribution: "Distribución",
    production: "Producción",
    crafting: "Fabricación",
    turret: "Torreta",
    bullet: "Mejora de Bala",
    liquid: "Líquido",
    defense: "Defensa",
    power: "Energía",
    effect: "Efecto",
    unit: "Unidad",
    logic: "Lógica"
};
var CATEGORY_LABELS_VI = {
    distribution: "Vận chuyển",
    production: "Khai thác",
    crafting: "Chế tạo",
    turret: "Tháp pháo",
    bullet: "Nâng cấp đạn",
    liquid: "Chất lỏng",
    defense: "Phòng thủ",
    power: "Năng lượng",
    effect: "Hiệu ứng",
    unit: "Đơn vị",
    logic: "Logic"
};
function catLabel(cat){
    var l = lang();
    if(l === "pt") return CATEGORY_LABELS_PT[cat] || cat;
    if(l === "es") return CATEGORY_LABELS_ES[cat] || cat;
    if(l === "vi") return CATEGORY_LABELS_VI[cat] || cat;
    return CATEGORY_LABELS_EN[cat] || cat;
}

var CATEGORY_STYLE = {
    distribution: {col:"[#f0ad4e]", tipEn:"Belts, ducts and routing", tipPt:"Esteiras, dutos e roteamento"},
    production:   {col:"[#5cb85c]", tipEn:"Drills and extractors", tipPt:"Brocas e extratores"},
    crafting:     {col:"[#5bc0de]", tipEn:"Factories and presses", tipPt:"Fabricas e prensas"},
    turret:       {col:"[#d9534f]", tipEn:"Defensive turrets", tipPt:"Torres de defesa"},
    bullet:       {col:"[#ff8a65]", tipEn:"Bullet damage & fire rate", tipPt:"Dano e cadencia de tiros"},
    liquid:       {col:"[#4fc3f7]", tipEn:"Pumps and conduits", tipPt:"Bombas e condutos"},
    defense:      {col:"[#9e9e9e]", tipEn:"Walls and shields", tipPt:"Paredes e escudos"},
    power:        {col:"[#ffd54f]", tipEn:"Generation and batteries", tipPt:"Geracao e baterias"},
    effect:       {col:"[#ba68c8]", tipEn:"Support and projectors", tipPt:"Suporte e projetores"},
    unit:         {col:"[#81c784]", tipEn:"Factories and pads", tipPt:"Fabricas e plataformas"},
    logic:        {col:"[#90a4ae]", tipEn:"Processors and switches", tipPt:"Processadores e switches"}
};
function categoryIcon(cat){
    try{
        if(cat === "distribution") return Icon.box;
        if(cat === "production") return Icon.wrench;
        if(cat === "crafting") return Icon.crafting;
        if(cat === "turret") return Icon.turret;
        if(cat === "bullet") return Icon.modeAttack;
        if(cat === "ammo") return Icon.modeAttack;
        if(cat === "liquid") return Icon.liquid;
        if(cat === "defense") return Icon.defense;
        if(cat === "power") return Icon.power;
        if(cat === "effect") return Icon.effect;
        if(cat === "unit") return Icon.units;
        if(cat === "logic") return Icon.logic;
    }catch(e){}
    return Icon.book;
}

var CATEGORY_NAMES_EN = {
    crafting: ["Recipe Precision", "Thermal Harmony", "Catalyst Feed", "Parallel Crafting", "Crafting Overclock"],
    distribution: ["High-Speed Routing", "Reinforced Guides", "Traffic Control", "Buffer Network", "Logistics Overclock"],
    production: ["Precision Assembly", "Thermal Calibration", "Automated Feed", "Parallel Chambers", "Overclock Matrix"],
    turret: ["Servo Aim", "Rapid Cycle", "Targeting Array", "Barrel Tuning", "Combat Overclock"],
    liquid: ["Flow Pressure", "Valve Tuning", "Reservoir Control", "Pipe Calibration", "Hydraulic Overdrive"],
    defense: ["Reinforced Frame", "Impact Bracing", "Rapid Recovery", "Shield Tuning", "Fortress Overclock"],
    power: ["Flux Tuning", "Voltage Regulation", "Thermal Balancing", "Grid Stabilizer", "Overcharged Core"],
    effect: ["Emitter Calibration", "Pulse Focusing", "Field Amplifier", "Cycle Optimization", "Effect Overdrive"],
    unit: ["Assembly Precision", "Servo Control", "Fabrication Feed", "Parallel Assembly", "Unit Overclock"],
    logic: ["Clock Tuning", "Instruction Routing", "Memory Handling", "Processor Cooling", "Logic Overclock"]
};
var CATEGORY_NAMES_PT = {
    crafting: ["Precisão de Receita", "Harmonia Térmica", "Alimentação de Catalisador", "Crafting Paralelo", "Overclock de Crafting"],
    distribution: ["Roteamento de Alta Velocidade", "Guias Reforcadas", "Controle de Trafego", "Rede de Buffer", "Overclock Logistico"],
    production: ["Montagem de Precisao", "Calibracao Termica", "Alimentacao Automatica", "Camara Paralela", "Matriz de Overclock"],
    turret: ["Mira Servo", "Ciclo Rapido", "Matriz de Mira", "Ajuste do Cano", "Overclock de Combate"],
    liquid: ["Pressao de Fluxo", "Ajuste de Valvulas", "Controle de Reservatorio", "Calibracao de Tubos", "Overdrive Hidraulico"],
    defense: ["Estrutura Reforcada", "Blindagem de Impacto", "Recuperacao Rapida", "Ajuste de Escudo", "Overclock de Fortaleza"],
    power: ["Ajuste de Fluxo", "Regulacao de Tensao", "Balanceamento Termico", "Estabilizador da Rede", "Nucleo Sobrecarregado"],
    effect: ["Calibracao do Emissor", "Foco de Pulsos", "Amplificador de Campo", "Otimizacao de Ciclo", "Overdrive de Efeito"],
    unit: ["Precisao de Montagem", "Controle de Servo", "Alimentacao de Fabricacao", "Montagem Paralela", "Overclock de Unidade"],
    logic: ["Ajuste de Clock", "Roteamento de Instrucoes", "Gerenciamento de Memoria", "Resfriamento do Processador", "Overclock Logico"]
};
var BLOCK_GROUPS = {};
var CATEGORY_GROUPS = {};
var GLOBAL_TRANSPORT_BY_BLOCK = {};
var GLOBAL_TRANSPORT_GROUPS = {};
var catalogBuilt = false;
var MASTER_UPGRADES = {};

function masterId(blockName, index){
    return "master-" + safePart(blockName) + "-" + (index + 1);
}

function masterSpecsForBlock(block){
    var n = block == null ? "" : ("" + block.name).toLowerCase();
    var specs = [];
    if(n === "duo") specs = [
        {en:"Metaglass Ammunition",pt:"Munição de Metaglass",kind:"duo-metaglass",descEn:"Unlocks metaglass as a new ammunition type. It keeps the Duo's normal ammo and adds a specialized projectile.",descPt:"Desbloqueia metaglass como nova munição. Mantém a munição normal do Duo e adiciona um projétil especializado."},
        {en:"Predictive Aim",pt:"Mira Preditiva",kind:"turret-air",descEn:"Adds air-targeting capability and improves tracking response.",descPt:"Adiciona capacidade de atingir alvos aéreos e melhora a resposta de mira."},
        {en:"Twin Feed",pt:"Alimentação Dupla",kind:"turret-dual",descEn:"Expands the Duo's firing system into a higher-throughput two-feed weapon.",descPt:"Expande o sistema de disparo do Duo para uma arma de maior fluxo com duas alimentações."}
    ];
    else if(n === "scorch") specs = [
        {en:"Anti-Air Ignition",pt:"Ignição Antiaérea",kind:"scorch-air",descEn:"The Scorch can now target flying enemies with its flame weapon.",descPt:"O Scorch agora pode mirar em inimigos voadores com sua arma de fogo."},
        {en:"Long-Flame Nozzle",pt:"Bocal de Chama Longa",kind:"turret-range",descEn:"Extends the effective reach of the flame weapon.",descPt:"Aumenta o alcance efetivo da arma de chamas."},
        {en:"Flash Igniter",pt:"Ignição Relâmpago",kind:"turret-burst",descEn:"Adds a stronger opening burst after the turret acquires a target.",descPt:"Adiciona uma rajada inicial mais forte após a torre adquirir um alvo."}
    ];
    else if(n === "arc") specs = [
        {en:"Chain Conduction",pt:"Condução em Cadeia",kind:"arc-chain",descEn:"The Arc can chain its electrical attack to an additional nearby target.",descPt:"O Arc pode encadear seu ataque elétrico para um alvo próximo adicional."},
        {en:"Predictive Aim",pt:"Mira Preditiva",kind:"turret-air",descEn:"Improves tracking and enables air targeting.",descPt:"Melhora a mira e habilita alvos aéreos."},
        {en:"Overvoltage",pt:"Sobretensão",kind:"turret-burst",descEn:"Adds a stronger electrical opening burst.",descPt:"Adiciona uma rajada elétrica inicial mais forte."}
    ];
    else if(n === "scatter") specs = [
        {en:"Slug Chamber",pt:"Câmara de Projétil",kind:"turret-ammo",descEn:"Adds a heavier secondary firing profile to the Scatter.",descPt:"Adiciona um perfil secundário de disparo mais pesado ao Scatter."},
        {en:"Predictive Aim",pt:"Mira Preditiva",kind:"turret-air",descEn:"Improves tracking against fast air targets.",descPt:"Melhora a mira contra alvos aéreos rápidos."},
        {en:"Wide Choke",pt:"Dispersão Ampliada",kind:"turret-spread",descEn:"Widened firing pattern for closer targets.",descPt:"Aumenta o padrão de dispersão contra alvos próximos."}
    ];
    else if(n === "hail") specs = [
        {en:"Guided Shells",pt:"Projéteis Guiados",kind:"turret-guided",descEn:"Improves projectile guidance after firing.",descPt:"Melhora a orientação dos projéteis após o disparo."},
        {en:"Predictive Aim",pt:"Mira Preditiva",kind:"turret-air",descEn:"Improves tracking and enables air targeting.",descPt:"Melhora a mira e habilita alvos aéreos."},
        {en:"Bunker Breaker",pt:"Quebra-Bunkers",kind:"turret-burst",descEn:"Adds a stronger impact profile against ground targets.",descPt:"Adiciona um impacto mais forte contra alvos terrestres."}
    ];
    else if(n === "salvo") specs = [
        {en:"Burst Logic",pt:"Lógica de Rajada",kind:"turret-burst",descEn:"Adds a stronger opening burst to the Salvo's firing cycle.",descPt:"Adiciona uma rajada inicial mais forte ao ciclo do Salvo."},
        {en:"Predictive Aim",pt:"Mira Preditiva",kind:"turret-air",descEn:"Improves tracking and enables air targeting.",descPt:"Melhora a mira e habilita alvos aéreos."},
        {en:"Ammo Mixer",pt:"Misturador de Munição",kind:"turret-ammo",descEn:"Adds a specialized secondary ammo profile when supported.",descPt:"Adiciona um perfil secundário de munição quando suportado."}
    ];
    else if(n === "lancer") specs = [
        {en:"Piercing Lance",pt:"Lança Perfurante",kind:"turret-pierce",descEn:"The lance projectile gains stronger piercing behavior.",descPt:"O projétil da lança ganha comportamento de perfuração mais forte."},
        {en:"Predictive Aim",pt:"Mira Preditiva",kind:"turret-air",descEn:"Improves tracking and enables air targeting.",descPt:"Melhora a mira e habilita alvos aéreos."},
        {en:"Charged Chamber",pt:"Câmara Carregada",kind:"turret-burst",descEn:"Adds a stronger charged opening shot.",descPt:"Adiciona um disparo inicial carregado mais forte."}
    ];
    else if(n === "duo"){}
    if(specs.length === 0){
        var cat = categoryOfBlock(block);
        if(cat === "turret") specs = [
            {en:"Adaptive Targeting",pt:"Mira Adaptativa",kind:"turret-air",descEn:"Unlocks improved tracking and air targeting where the weapon supports it.",descPt:"Desbloqueia melhor rastreamento e mira aérea quando a arma suporta isso."},
            {en:"Specialized Chamber",pt:"Câmara Especializada",kind:"turret-burst",descEn:"Adds a specialized firing behavior to the turret.",descPt:"Adiciona um comportamento especializado de disparo à torre."},
            {en:"Combat Protocol",pt:"Protocolo de Combate",kind:"turret-response",descEn:"Improves target acquisition and firing response.",descPt:"Melhora a aquisição de alvos e a resposta de disparo."}
        ];
        else if(cat === "production" || cat === "crafting") specs = [
            {en:"Parallel Processing",pt:"Processamento Paralelo",kind:"factory-parallel",descEn:"Adds a secondary processing cycle to reduce idle time.",descPt:"Adiciona um ciclo secundário de processamento para reduzir tempo ocioso."},
            {en:"Adaptive Feed",pt:"Alimentação Adaptativa",kind:"factory-feed",descEn:"Improves handling of input materials and production flow.",descPt:"Melhora o tratamento dos materiais de entrada e o fluxo de produção."},
            {en:"Emergency Cycle",pt:"Ciclo de Emergência",kind:"factory-burst",descEn:"Adds a temporary production surge after idle periods.",descPt:"Adiciona um surto temporário de produção após períodos ociosos."}
        ];
        else if(cat === "liquid") specs = [
            {en:"Pressure Reserve",pt:"Reserva de Pressão",kind:"liquid-reserve",descEn:"Stores a reserve of liquid to smooth short interruptions.",descPt:"Armazena uma reserva de líquido para suavizar interrupções curtas."},
            {en:"Fluid Separation",pt:"Separação de Fluidos",kind:"liquid-separation",descEn:"Improves fluid handling when multiple liquid types are supported.",descPt:"Melhora o manuseio de fluidos quando vários tipos são suportados."},
            {en:"Surge Valve",pt:"Válvula de Surto",kind:"liquid-burst",descEn:"Adds a short high-flow discharge cycle.",descPt:"Adiciona um curto ciclo de descarga de alto fluxo."}
        ];
        else specs = [
            {en:"Reinforced Core",pt:"Núcleo Reforçado",kind:"generic-cap",descEn:"Adds a block-specific capacity or resilience improvement.",descPt:"Adiciona uma melhoria específica de capacidade ou resistência."},
            {en:"Adaptive System",pt:"Sistema Adaptativo",kind:"generic-adaptive",descEn:"Adds a behavior tuned to this block's role.",descPt:"Adiciona um comportamento ajustado à função deste bloco."},
            {en:"Emergency Protocol",pt:"Protocolo de Emergência",kind:"generic-emergency",descEn:"Unlocks a special response when the block is under pressure.",descPt:"Desbloqueia uma resposta especial quando o bloco está sob pressão."}
        ];
    }
    return specs.slice(0,3);
}

function makeMasterUp(id, blockFn, costFn, spec){
    var b = blockFn != null ? blockFn() : null;
    var loc = b != null && b.localizedName != null ? ("" + b.localizedName) : "Block";
    var u = makeUp(id, blockFn, 1, costFn, loc + " — " + spec.en, loc + " — " + spec.pt, spec.descEn + " // " + loc, spec.descPt + " // " + loc, id + " master upgrade");
    u.master = true;
    u.masterKind = spec.kind;
    return u;
}

function ensureMasterUpgrades(group){
    if(group == null) return;
    var b = group.block();
    if(b == null) return;
    if(group.masterUpgrades != null && group.masterUpgrades.length > 0) return;
    group.masterUpgrades = [];
    var target = rangeCount(blockSeed(b.name) >> 5, 3, 5); // 3-5 master cards
    group.masterCount = target;
    var specs = masterSpecsForBlock(b);
    if(specs == null) specs = [];
    var fillers = [
        {en:"Overclock Core", pt:"Nucleo Overclock", kind:"generic-overclock",
            descEn:"Pushes the block harder. Short words: more output.", descPt:"Força o bloco. Em poucas palavras: mais saida."},
        {en:"Reinforced Frame", pt:"Estrutura Reforçada", kind:"generic-frame",
            descEn:"Sturdier internals. Runs a bit smoother under load.", descPt:"Interior mais firme. Roda um pouco mais estavel sob carga."},
        {en:"Emergency Surge", pt:"Surto de Emergencia", kind:"generic-surge",
            descEn:"A brief performance spike when things get messy.", descPt:"Um pico breve de desempenho quando a coisa aperta."},
        {en:"Precision Tuning", pt:"Ajuste de Precisao", kind:"generic-tune",
            descEn:"Fine-tunes the operating cycle for fewer wasted ticks.", descPt:"Ajusta o ciclo para desperdiçar menos ticks."},
        {en:"Field Calibration", pt:"Calibracao de Campo", kind:"generic-field",
            descEn:"Aligns sensors and actuators. Mostly works.", descPt:"Alinha sensores e atuadores. Na maior parte funciona."}
    ];
    var fi = 0;
    while(specs.length < target){
        specs.push(fillers[fi % fillers.length]);
        fi++;
    }
    for(var i = 0; i < target; i++){
        var id = masterId("" + b.name, i);
        if(MASTER_UPGRADES[id] == null){
            (function(upId, spec, index){
                MASTER_UPGRADES[upId] = makeMasterUp(upId, group.block, function(lv){
                    return autoMasterCost(group.block, index, lv);
                }, spec);
            })(id, specs[i], i);
        }
        group.masterUpgrades.push(id);
    }
}

function autoMasterCost(blockFn, index, lv){
    var b = blockFn();
    var req = b != null ? b.requirements : null;
    var out = [];
    if(req != null && req.length > 0){
        var take = Math.min(4, req.length);
        for(var i = 0; i < take; i++){
            var r = req[(i + index) % req.length];
            if(r != null && r.item != null) out.push([r.item, Math.max(60, Math.floor(r.amount * (1.6 + index * 0.45)) + lv * (80 + index * 40))]);
        }
    }
    if(out.length === 0) out.push([Items.copper, 700 + index * 350 + lv * 250]);
    return out;
}


function classNameOf(obj){
    try{ return "" + obj.getClass().getSimpleName(); }catch(e){}
    try{ return "" + obj.getClass().getName(); }catch(e2){}
    return "";
}

function categoryOfBlock(b){
    if(b == null) return "production";
    try{
        var c = ("" + b.category).toLowerCase();
        if(c === "units") return "unit";
        if(CATEGORY_LABELS_EN[c] != null) return c;
    }catch(e){}
    return "production";
}

function currentPlanetObject(){
    try{
        if(Vars.state != null && Vars.state.rules != null && Vars.state.rules.planet != null) return Vars.state.rules.planet;
    }catch(e){}
    return null;
}

function blockVisibleNow(b){
    if(b == null) return false;
    try{ if(!b.logicVisible()) return false; }catch(e){}
    try{
        if(b.buildVisibility != null && !b.buildVisibility.visible()) return false;
    }catch(e2){}
    return true;
}

function isSunPlanet(p){
    try{
        if(p == null) return false;
        var n = ("" + (p.name != null ? p.name : "")).toLowerCase();
        // Sun = combined "any planet" view in campaign navigator
        return n === "sun" || n === "any" || n === "all";
    }catch(e){ return false; }
}

function blockOnCurrentPlanet(b){
    if(b == null) return false;
    var p = currentPlanetObject();
    // Sun / any / no planet context => show content from every planet
    if(p == null || isSunPlanet(p)) return true;
    try{
        var pn = ("" + p.name).toLowerCase();
        if(pn === "" || pn === "custom") return true;
    }catch(e0){}
    try{
        var planets = b.shownPlanets;
        // Empty / null shownPlanets = available on all planets (vanilla convention for shared tech)
        if(planets == null || planets.size <= 0) return true;
        if(planets.contains(p)) return true;
        // Some content lists parent/sun as shown planet meaning "any"
        try{
            var it = planets.iterator();
            while(it.hasNext()){
                var sp = it.next();
                if(isSunPlanet(sp)) return true;
            }
        }catch(eIt){}
        return false;
    }catch(e){}
    return true;
}

function planetKeyForBlock(b){
    try{
        var planets = b.shownPlanets;
        if(planets == null || planets.size <= 0) return "any";
        if(planets.size === 1){
            var p = planets.first();
            if(p != null && p.name != null){
                var n = ("" + p.name).toLowerCase();
                if(n === "sun") return "any";
                return "" + p.name;
            }
        }
        // Multi-planet blocks
        return "any";
    }catch(e){}
    return "any";
}


function unitPlanetKey(u){
    if(u == null) return "any";
    try{
        // Explicit planet field when present
        if(u.planet != null && u.planet.name != null){
            var pn = ("" + u.planet.name).toLowerCase();
            if(pn === "sun") return "any";
            return pn;
        }
    }catch(e0){}
    // Cost / requirement heuristics for Erekir units
    try{
        var req = u.researchRequirements != null ? u.researchRequirements() : null;
        if(req != null){
            for(var i = 0; i < req.length; i++){
                var it = req[i].item;
                if(it == null) continue;
                var n = ("" + it.name).toLowerCase();
                if(n === "beryllium" || n === "tungsten" || n === "oxide" || n === "carbide" || n === "thorium"){
                    if(n === "beryllium" || n === "tungsten" || n === "oxide" || n === "carbide") return "erekir";
                }
            }
        }
    }catch(e1){}
    try{
        if(u.internalName != null){
            // no-op
        }
        var name = ("" + u.name).toLowerCase();
        // Common Erekir unit names
        var erekir = ["stell","locus","precept","vanquish","conquer","merui","cleroi","anthicus","tecta","collaris","elude","avert","obviate","quell","disrupt","renale","latum"];
        for(var k = 0; k < erekir.length; k++){
            if(name.indexOf(erekir[k]) >= 0) return "erekir";
        }
    }catch(e2){}
    return "serpulo";
}

function unitOnCurrentPlanet(u){
    if(u == null) return false;
    var p = currentPlanetObject();
    if(p == null || isSunPlanet(p)) return true;
    try{
        var pn = ("" + p.name).toLowerCase();
        if(pn === "" || pn === "custom") return true;
        var uk = unitPlanetKey(u);
        if(uk === "any") return true;
        return uk === pn;
    }catch(e){ return true; }
}

function planetLabelForBlock(b){
    var key = planetKeyForBlock(b);
    if(key === "any" || key === "shared") return tr("ANY PLANET", "QUALQUER PLANETA", "CUALQUIER PLANETA", "MỌI HÀNH TINH");
    try{
        var planets = b.shownPlanets;
        if(planets != null && planets.size === 1){
            var p = planets.first();
            if(p != null){
                try{ return ("" + p.localizedName).toUpperCase(); }catch(e){}
                return ("" + p.name).toUpperCase();
            }
        }
    }catch(e2){}
    return ("" + key).toUpperCase();
}

function isTransportBlock(b){
    if(b == null) return false;
    var n = "" + b.name;
    var c = classNameOf(b).toLowerCase();
    var ln = n.toLowerCase();
    return c.indexOf("conveyor") >= 0 || c.indexOf("duct") >= 0 || ln.indexOf("conveyor") >= 0 || ln.indexOf("duct") >= 0;
}

function blockProfile(b){
    var c = categoryOfBlock(b);
    var cls = classNameOf(b).toLowerCase();
    var n = b == null ? "" : ("" + b.name).toLowerCase();
    // Each index = a DIFFERENT role. names*: [en,pt,es,vi] arrays of 5
    function pack(names, descs, boosts, aim){
        return {
            kind: names.kind || "generic", category: c,
            namesEn: names.en, namesPt: names.pt, namesEs: names.es, namesVi: names.vi,
            descEn: descs.en, descPt: descs.pt, descEs: descs.es, descVi: descs.vi,
            boosts: boosts, aim: aim
        };
    }
    if(cls.indexOf("turret") >= 0) return pack(
        {kind:"turret",
            en:["Aim Assist", "Reload Timing", "Target Priority", "Recoil Brace", "Burst Window"],
            pt:["Ajuda de Mira", "Tempo de Recarga", "Prioridade de Alvo", "Trava de Recuo", "Janela de Rajada"],
            es:["Ayuda de Mira", "Tiempo de Recarga", "Prioridad de Blanco", "Freno de Retroceso", "Ventana de Ráfaga"],
            vi:["Hỗ trợ ngắm", "Nhịp nạp đạn", "Ưu tiên mục tiêu", "Chống giật", "Cửa sổ xả đạn"]},
        {en:["Turns toward enemies faster.", "Shortens time between shots.", "Locks the current target more firmly.", "Keeps the barrel steadier while firing.", "Improves the first shots of a fight."],
         pt:["Vira para o inimigo mais rápido.", "Diminui o tempo entre tiros.", "Mantém o alvo atual com mais firmeza.", "Mantém o cano mais firme ao atirar.", "Melhora os primeiros tiros do combate."],
         es:["Gira hacia el enemigo más rápido.", "Reduce el tiempo entre disparos.", "Mantiene mejor el blanco actual.", "Mantiene el cañón más firme al disparar.", "Mejora los primeros disparos del combate."],
         vi:["Xoay về địch nhanh hơn.", "Giảm thời gian giữa các phát.", "Giữ mục tiêu hiện tại chắc hơn.", "Nòng súng ổn định hơn khi bắn.", "Cải thiện các phát đầu trận."]},
        [0.08, 0.07, 0.06, 0.075, 0.09], [0.15, 0.10, 0.12, 0.18, 0.13]
    );
    if(cls.indexOf("drill") >= 0 || n.indexOf("drill") >= 0) return pack(
        {kind:"drill",
            en:["Sharper Bit", "Stable Bore", "Motor Tune", "Ore Chute", "Deep Push"],
            pt:["Broca Mais Afiada", "Furo Estável", "Ajuste do Motor", "Calha de Minério", "Empurrão Profundo"],
            es:["Broca más Afilada", "Perforación Estable", "Ajuste del Motor", "Tolva de Mineral", "Empuje Profundo"],
            vi:["Mũi khoan sắc", "Lỗ khoan ổn định", "Chỉnh động cơ", "Máng quặng", "Đẩy sâu hơn"]},
        {en:["Mines a bit faster.", "Fewer stalled dig cycles.", "Smoother power to the bit.", "Moves ore out of the drill quicker.", "Raises sustained mining speed."],
         pt:["Mina um pouco mais rápido.", "Menos ciclos de escavação parados.", "Potência mais estável na broca.", "Tira o minério da broca mais rápido.", "Aumenta a velocidade de mineração."],
         es:["Mina un poco más rápido.", "Menos ciclos de excavación detenidos.", "Potencia más estable en la broca.", "Saca el mineral más rápido.", "Sube la velocidad de minado."],
         vi:["Đào nhanh hơn một chút.", "Ít chu kỳ đào bị đứng.", "Công suất mũi khoan ổn định hơn.", "Đưa quặng ra nhanh hơn.", "Tăng tốc độ đào bền vững."]},
        [0.11, 0.09, 0.08, 0.07, 0.12], null
    );
    if(cls.indexOf("conveyor") >= 0 || cls.indexOf("duct") >= 0 || c === "distribution") return pack(
        {kind:"distribution",
            en:["Smoother Rollers", "Centered Path", "Gap Control", "Short Buffer", "Line Capacity"],
            pt:["Rolos Mais Lisos", "Caminho Central", "Controle de Espaço", "Buffer Curto", "Capacidade da Linha"],
            es:["Rodillos más Suaves", "Ruta Centrada", "Control de Huecos", "Búfer Corto", "Capacidad de Línea"],
            vi:["Con lăn mượt", "Làn giữa", "Giảm kẹt", "Bộ đệm ngắn", "Công suất dây chuyền"]},
        {en:["Items stutter less on the belt.", "Keeps cargo in the middle of the lane.", "Reduces pile-ups at merges.", "Absorbs short traffic spikes.", "Higher sustained item flow."],
         pt:["Itens engasgam menos na esteira.", "Mantém a carga no meio da faixa.", "Reduz filas em cruzamentos.", "Aguenta picos curtos de tráfego.", "Maior fluxo contínuo de itens."],
         es:["Los ítems traban menos en la cinta.", "Mantiene la carga al centro.", "Reduce atascos en cruces.", "Aguanta picos cortos de tráfico.", "Mayor flujo continuo de ítems."],
         vi:["Ít bị khựng trên băng tải.", "Giữ hàng ở giữa làn.", "Giảm tắc ở điểm giao.", "Chịu được sóng tải ngắn.", "Tăng lưu lượng hàng ổn định."]},
        [0.09, 0.08, 0.07, 0.085, 0.11], null
    );
    if(cls.indexOf("pump") >= 0 || cls.indexOf("conduit") >= 0 || cls.indexOf("liquid") >= 0 || c === "liquid") return pack(
        {kind:"liquid",
            en:["Faster Intake", "Clean Valves", "Tank Leveling", "Soft Pressure", "Peak Flow"],
            pt:["Entrada Mais Rápida", "Válvulas Limpas", "Nível do Tanque", "Pressão Suave", "Fluxo Máximo"],
            es:["Entrada más Rápida", "Válvulas Limpias", "Nivel del Tanque", "Presión Suave", "Flujo Máximo"],
            vi:["Hút nhanh hơn", "Van sạch", "Cân bằng bồn", "Áp suất êm", "Dòng đỉnh"]},
        {en:["Pulls liquid in faster.", "Valves open/close more cleanly.", "Internal storage stays balanced.", "Fewer pressure spikes.", "Higher sustained liquid throughput."],
         pt:["Puxa líquido mais rápido.", "Válvulas abrem/fecham melhor.", "Estoque interno fica equilibrado.", "Menos picos de pressão.", "Maior fluxo contínuo de líquido."],
         es:["Aspira líquido más rápido.", "Las válvulas abren/cierran mejor.", "El tanque interno se equilibra.", "Menos picos de presión.", "Mayor flujo continuo de líquido."],
         vi:["Hút chất lỏng nhanh hơn.", "Van mở/đóng mượt hơn.", "Bồn trong ổn định hơn.", "Ít đột biến áp suất.", "Tăng lưu lượng chất lỏng."]},
        [0.10, 0.075, 0.07, 0.085, 0.11], null
    );
    if(cls.indexOf("factory") >= 0 || cls.indexOf("crafter") >= 0 || c === "production" || c === "crafting") return pack(
        {kind:"factory",
            en:["Cleaner Feed", "Shorter Cycle", "Heat Control", "Faster Output", "Plant Overdrive"],
            pt:["Carga Mais Limpa", "Ciclo Mais Curto", "Controle de Calor", "Saída Mais Rápida", "Overdrive da Planta"],
            es:["Carga más Limpia", "Ciclo más Corto", "Control de Calor", "Salida más Rápida", "Overdrive de Planta"],
            vi:["Nạp sạch hơn", "Chu kỳ ngắn hơn", "Kiểm soát nhiệt", "Xuất nhanh hơn", "Tăng tốc nhà máy"]},
        {en:["Inputs start crafts more reliably.", "Less waiting between crafts.", "Keeps process heat useful.", "Finished items leave faster.", "Raises sustained craft speed."],
         pt:["Entradas iniciam crafts com mais certeza.", "Menos espera entre crafts.", "Mantém o calor útil no processo.", "Itens prontos saem mais rápido.", "Aumenta a velocidade de craft."],
         es:["Las entradas inician crafts con más certeza.", "Menos espera entre crafts.", "Mantiene el calor útil.", "Los ítems listos salen más rápido.", "Sube la velocidad de craft."],
         vi:["Nguyên liệu vào ổn định hơn.", "Ít chờ giữa các mẻ.", "Giữ nhiệt trong vùng hữu ích.", "Hàng xong ra nhanh hơn.", "Tăng tốc độ chế tạo."]},
        [0.09, 0.08, 0.075, 0.085, 0.105], null
    );
    if(cls.indexOf("unitfactory") >= 0 || cls.indexOf("reconstructor") >= 0 || c === "unit") return pack(
        {kind:"unit",
            en:["Frame Align", "Servo Step", "Part Feed", "Build Tolerance", "Yard Overdrive"],
            pt:["Alinha Estrutura", "Passo do Servo", "Carga de Peças", "Tolerância de Montagem", "Overdrive do Pátio"],
            es:["Alineación de Bastidor", "Paso del Servo", "Carga de Piezas", "Tolerancia de Montaje", "Overdrive del Patio"],
            vi:["Canh khung", "Bước servo", "Nạp linh kiện", "Dung sai lắp", "Tăng tốc xưởng"]},
        {en:["Assembly steps line up better.", "Less delay between build stages.", "Parts arrive more steadily.", "Tighter reconstruction accuracy.", "Faster sustained unit production."],
         pt:["Etapas de montagem alinham melhor.", "Menos atraso entre estágios.", "Peças chegam com mais constância.", "Reconstrução mais precisa.", "Produz unidades mais rápido."],
         es:["Los pasos de montaje alinean mejor.", "Menos retraso entre etapas.", "Las piezas llegan más constantes.", "Reconstrucción más precisa.", "Produce unidades más rápido."],
         vi:["Các bước lắp khớp hơn.", "Ít trễ giữa các giai đoạn.", "Linh kiện vào đều hơn.", "Tái tạo chính xác hơn.", "Sản xuất unit nhanh hơn."]},
        [0.09, 0.075, 0.08, 0.085, 0.105], null
    );
    if(cls.indexOf("power") >= 0 || c === "power") return pack(
        {kind:"power",
            en:["Coil Efficiency", "Grid Link", "Spike Guard", "Stable Output", "Power Push"],
            pt:["Eficiência das Bobinas", "Ligação à Rede", "Proteção de Pico", "Saída Estável", "Empurrão de Energia"],
            es:["Eficiencia de Bobinas", "Enlace a la Red", "Protección de Picos", "Salida Estable", "Empuje de Energía"],
            vi:["Hiệu suất cuộn", "Nối lưới", "Chống đột biến", "Đầu ra ổn", "Đẩy công suất"]},
        {en:["Slightly better energy conversion.", "Cleaner connection to the grid.", "Softens sudden power spikes.", "More stable continuous output.", "Higher sustained power throughput."],
         pt:["Conversão de energia um pouco melhor.", "Ligação mais limpa à rede.", "Suaviza picos súbitos de energia.", "Saída contínua mais estável.", "Maior vazão de energia."],
         es:["Mejor conversión de energía.", "Conexión más limpia a la red.", "Suaviza picos súbitos.", "Salida continua más estable.", "Mayor caudal de energía."],
         vi:["Chuyển đổi năng lượng tốt hơn.", "Kết nối lưới sạch hơn.", "Làm mượt đột biến điện.", "Đầu ra ổn định hơn.", "Tăng công suất liên tục."]},
        [0.08, 0.07, 0.075, 0.08, 0.10], null
    );
    if(c === "defense") return pack(
        {kind:"defense",
            en:["Plate Bond", "Impact Spread", "Stress Share", "Ablative Skin", "Hold Fast"],
            pt:["União das Placas", "Espalha Impacto", "Divide Tensão", "Pele Ablativa", "Aguenta Firme"],
            es:["Unión de Placas", "Reparto de Impacto", "Comparte Tensión", "Piel Ablativa", "Resiste Firme"],
            vi:["Liên kết tấm", "Phân tán va đập", "Chia tải", "Lớp hy sinh", "Giữ vững"]},
        {en:["Plates stay joined under fire.", "Spreads hits across the wall.", "Shares stress with neighbors.", "Outer layer eats the first hits.", "Max structural hold under pressure."],
         pt:["Placas ficam unidas sob fogo.", "Espalha os hits pela parede.", "Divide a tensão com vizinhos.", "Camada externa leva os primeiros hits.", "Máxima firmeza sob pressão."],
         es:["Las placas se mantienen unidas.", "Reparte los golpes en el muro.", "Comparte tensión con vecinos.", "La capa externa absorbe los primeros golpes.", "Máxima firmeza bajo presión."],
         vi:["Tấm vẫn dính khi bị bắn.", "Trải sát thương trên tường.", "Chia lực với ô bên cạnh.", "Lớp ngoài chịu đòn đầu.", "Giữ kết cấu tối đa."]},
        [0.07, 0.08, 0.07, 0.085, 0.09], null
    );
    if(c === "effect") return pack(
        {kind:"effect",
            en:["Field Focus", "Projector Sync", "Edge Coverage", "Pulse Strength", "Support Push"],
            pt:["Foco de Campo", "Sync do Projetor", "Cobertura da Borda", "Força do Pulso", "Empurrão de Suporte"],
            es:["Foco de Campo", "Sincronía del Proyector", "Cobertura del Borde", "Fuerza del Pulso", "Empuje de Soporte"],
            vi:["Tập trung trường", "Đồng bộ máy chiếu", "Phủ mép", "Cường độ xung", "Đẩy hỗ trợ"]},
        {en:["Support field is tighter.", "Projector cycles stay in sync.", "Coverage edge is cleaner.", "Stronger support pulses.", "Higher sustained support effect."],
         pt:["Campo de suporte mais firme.", "Ciclos do projetor ficam sincronizados.", "Borda da cobertura mais limpa.", "Pulsos de suporte mais fortes.", "Efeito de suporte mais constante."],
         es:["Campo de soporte más firme.", "Los ciclos del proyector se sincronizan.", "Borde de cobertura más limpio.", "Pulsos de soporte más fuertes.", "Efecto de soporte más constante."],
         vi:["Trường hỗ trợ chặt hơn.", "Chu kỳ máy chiếu khớp hơn.", "Mép vùng phủ sạch hơn.", "Xung hỗ trợ mạnh hơn.", "Hiệu ứng hỗ trợ ổn định hơn."]},
        [0.08, 0.075, 0.07, 0.085, 0.10], null
    );
    if(c === "logic") return pack(
        {kind:"logic",
            en:["Clock Trim", "Instruction Path", "Memory Clean", "Bus Cool", "Logic Push"],
            pt:["Ajuste de Clock", "Caminho da Instrução", "Memória Limpa", "Bus Frio", "Empurrão Lógico"],
            es:["Ajuste de Reloj", "Ruta de Instrucción", "Memoria Limpia", "Bus Fresco", "Empuje Lógico"],
            vi:["Chỉnh xung nhịp", "Đường lệnh", "Bộ nhớ sạch", "Bus mát", "Đẩy logic"]},
        {en:["Processor clock runs cleaner.", "Instructions wait less in queue.", "Memory access is tidier.", "Bus stays cooler under load.", "Higher sustained logic throughput."],
         pt:["Clock do processador mais limpo.", "Instruções esperam menos na fila.", "Acesso à memória mais organizado.", "Bus esquenta menos sob carga.", "Maior vazão lógica."],
         es:["El reloj del procesador es más limpio.", "Las instrucciones esperan menos.", "El acceso a memoria es más ordenado.", "El bus se calienta menos.", "Mayor caudal lógico."],
         vi:["Xung nhịp CPU sạch hơn.", "Lệnh chờ hàng đợi ít hơn.", "Truy cập bộ nhớ gọn hơn.", "Bus nóng ít hơn khi tải.", "Tăng thông lượng logic."]},
        [0.07, 0.08, 0.07, 0.075, 0.09], null
    );
    return pack(
        {kind:"generic",
            en:["Cycle Tune", "Load Balance", "Faster Response", "Less Idle", "System Push"],
            pt:["Ajuste de Ciclo", "Balance de Carga", "Resposta Mais Rápida", "Menos Ocio", "Empurrão do Sistema"],
            es:["Ajuste de Ciclo", "Balance de Carga", "Respuesta más Rápida", "Menos Inactivo", "Empuje del Sistema"],
            vi:["Chỉnh chu kỳ", "Cân bằng tải", "Phản hồi nhanh", "Ít chờ", "Đẩy hệ thống"]},
        {en:["Main cycle runs cleaner.", "Balances internal load.", "Responds a bit faster.", "Wastes fewer idle ticks.", "Higher sustained performance."],
         pt:["Ciclo principal mais limpo.", "Equilibra a carga interna.", "Responde um pouco mais rápido.", "Desperdiça menos ticks ociosos.", "Desempenho contínuo maior."],
         es:["El ciclo principal es más limpio.", "Equilibra la carga interna.", "Responde un poco más rápido.", "Desperdicia menos ticks inactivos.", "Mayor rendimiento continuo."],
         vi:["Chu kỳ chính mượt hơn.", "Cân bằng tải nội bộ.", "Phản hồi nhanh hơn một chút.", "Ít tick chờ lãng phí.", "Hiệu năng ổn định cao hơn."]},
        [0.08, 0.07, 0.075, 0.08, 0.10], null
    );
}

function blockCardName(b, profile, index){
    var loc = "Block";
    try{ if(b != null && b.localizedName != null) loc = "" + b.localizedName; }catch(e){}
    var short = loc.length > 18 ? loc.substring(0, 16) + "..." : loc;
    var nEn = (profile && profile.namesEn && profile.namesEn[index]) ? profile.namesEn[index] : ("Core " + (index + 1));
    var nPt = (profile && profile.namesPt && profile.namesPt[index]) ? profile.namesPt[index] : ("Principal " + (index + 1));
    var nEs = (profile && profile.namesEs && profile.namesEs[index]) ? profile.namesEs[index] : nEn;
    var nVi = (profile && profile.namesVi && profile.namesVi[index]) ? profile.namesVi[index] : nEn;
    return {
        en: short + " — " + nEn,
        pt: short + " — " + nPt,
        es: short + " — " + nEs,
        vi: short + " — " + nVi
    };
}

function upgradeNames(category, index, block){
    var profile = blockProfile(block);
    return blockCardName(block, profile, index);
}

function blockUpgradeContext(block){
    if(block == null) return "";
    var cls = classNameOf(block).toLowerCase();
    try{
        if((categoryOfBlock(block) === "crafting" || cls.indexOf("crafter") >= 0) && block.outputItem != null){
            return "Output: " + block.outputItem.item.localizedName + " x" + block.outputItem.amount;
        }
    }catch(e1){}
    try{
        if(cls.indexOf("turret") >= 0 && block.ammoTypes != null){
            return "Ammo profiles: " + block.ammoTypes.size;
        }
    }catch(e2){}
    try{
        if(categoryOfBlock(block) === "defense") return "Health: " + Math.round(block.health);
    }catch(e3){}
    try{
        if(categoryOfBlock(block) === "power" && block.powerProduction != null) return "Power output: " + block.powerProduction;
    }catch(e4){}
    try{
        if(block.size != null) return "Size: " + block.size + "x" + block.size;
    }catch(e5){}
    return "System: " + (block.localizedName != null ? block.localizedName : block.name);
}

function upgradeDescription(category, level, block, index){
    var profile = blockProfile(block);
    var pct = Math.round((profile.boosts[index] || 0.07) * 100);
    var en = (profile.descEn && profile.descEn[index]) ? profile.descEn[index] : "Improves this block.";
    var pt = (profile.descPt && profile.descPt[index]) ? profile.descPt[index] : "Melhora este bloco.";
    var es = (profile.descEs && profile.descEs[index]) ? profile.descEs[index] : en;
    var vi = (profile.descVi && profile.descVi[index]) ? profile.descVi[index] : en;
    var ctx = blockUpgradeContext(block);
    return tr(en + " (+" + pct + "% / rank) // " + ctx, pt + " (+" + pct + "% / nível) // " + ctx, es + " (+" + pct + "% / nivel) // " + ctx, vi + " (+" + pct + "% / cấp) // " + ctx);
}

function genericUpgradeId(blockName, index){
    return "auto-" + safePart(blockName) + "-" + (index + 1);
}

function pushUniqueResource(list, mode, resource){
    if(resource == null) return;
    var id = resource.id == null ? ("" + resource) : ("" + resource.id);
    for(var i = 0; i < list.length; i++){
        if(list[i].mode === mode && list[i].resource != null){
            var oldId = list[i].resource.id == null ? ("" + list[i].resource) : ("" + list[i].resource.id);
            if(oldId === id) return;
        }
    }
    list.push({mode:mode, resource:resource});
}

function acceptedConditionResources(block){
    var out = [];
    if(block == null) return out;

    // Turrets expose the resources they can actually fire with through ammoTypes.
    try{
        var ammo = block.ammoTypes;
        if(ammo != null && ammo.entries != null){
            ammo.entries().each(function(entry){
                try{ pushUniqueResource(out, classNameOf(block).toLowerCase().indexOf("liquid") >= 0 ? "liquid" : "item", entry.key); }catch(e){}
            });
        }
    }catch(e){}

    // Read real consumers. Do not fall back to build requirements: that was the source of
    // impossible conditions such as asking a turret to receive lead when lead is not ammo.
    try{
        var consumers = block.consumers;
        if(consumers != null){
            for(var i = 0; i < consumers.length; i++){
                var c = consumers[i];
                if(c == null) continue;
                var cn = classNameOf(c).toLowerCase();
                if(cn.indexOf("consumeliquid") >= 0){
                    try{ if(c.liquid != null) pushUniqueResource(out, "liquid", c.liquid); }catch(e1){}
                    try{
                        if(c.liquids != null){
                            for(var l = 0; l < c.liquids.length; l++){
                                var ls = c.liquids[l];
                                if(ls != null && ls.liquid != null) pushUniqueResource(out, "liquid", ls.liquid);
                            }
                        }
                    }catch(e2){}
                }
                if(cn.indexOf("consumeitem") >= 0){
                    try{ if(c.item != null) pushUniqueResource(out, "item", c.item); }catch(e3){}
                    try{
                        if(c.items != null){
                            for(var q = 0; q < c.items.length; q++){
                                var st = c.items[q];
                                if(st != null && st.item != null) pushUniqueResource(out, "item", st.item);
                            }
                        }
                    }catch(e4){}
                }
            }
        }
    }catch(e5){}

    // Some blocks expose explicit filters instead of ConsumerItem entries.
    try{
        if(block.itemFilter != null && Vars.content != null && Vars.content.items != null){
            Vars.content.items().each(function(item){
                try{ if(item != null && item.id != null && block.itemFilter[item.id]) pushUniqueResource(out, "item", item); }catch(e){}
            });
        }
    }catch(e6){}
    try{
        if(block.liquidFilter != null && Vars.content != null && Vars.content.liquids != null){
            Vars.content.liquids().each(function(liquid){
                try{ if(liquid != null && liquid.id != null && block.liquidFilter[liquid.id]) pushUniqueResource(out, "liquid", liquid); }catch(e){}
            });
        }
    }catch(e7){}
    return out;
}

function hasPowerInput(block){
    if(block == null) return false;
    try{
        var consumers = block.consumers;
        if(consumers != null){
            for(var i = 0; i < consumers.length; i++){
                var c = consumers[i];
                if(c != null && classNameOf(c).toLowerCase().indexOf("consumepower") >= 0) return true;
            }
        }
    }catch(e){}
    try{ return !!(block.hasPower && !block.outputsPower && block.consPower != null); }catch(e2){}
    return false;
}

function isFactoryLike(block){
    if(block == null) return false;
    var cls = classNameOf(block).toLowerCase();
    return categoryOfBlock(block) === "crafting" || cls.indexOf("crafter") >= 0 || cls.indexOf("press") >= 0 || cls.indexOf("smelter") >= 0 || cls.indexOf("mixer") >= 0 || cls.indexOf("furnace") >= 0;
}

function factoryRecipeSpec(block, resource, slot){
    if(!isFactoryLike(block) || resource == null) return null;
    var outItem = null, outAmount = 0;
    try{
        if(block.outputItem != null && block.outputItem.item != null){
            outItem = block.outputItem.item;
            outAmount = block.outputItem.amount|0;
        }else if(block.outputItems != null && block.outputItems.length > 0 && block.outputItems[0] != null){
            outItem = block.outputItems[0].item;
            outAmount = block.outputItems[0].amount|0;
        }
    }catch(e){}
    if(outItem == null || outAmount <= 0) return null;
    var baseInput = 0;
    try{
        var consumers = block.consumers;
        if(consumers != null){
            for(var i = 0; i < consumers.length; i++){
                var c = consumers[i];
                if(c == null || classNameOf(c).toLowerCase().indexOf("consumeitems") < 0 || c.items == null) continue;
                var arr = c.items;
                var len = arr.length != null ? arr.length : (arr.size != null ? arr.size : 0);
                for(var j = 0; j < len; j++){
                    var st = arr[j];
                    if(st == null && arr.get != null) st = arr.get(j);
                    if(st != null && st.item === resource){ baseInput = st.amount|0; break; }
                }
                if(baseInput > 0) break;
            }
        }
    }catch(e2){}
    if(baseInput <= 0) return null;
    var boostedInput = baseInput + 2;
    var boostedOutput = outAmount + 2;
    return {input:resource, baseInput:baseInput, boostedInput:boostedInput, output:outItem, baseOutput:outAmount, boostedOutput:boostedOutput, extraInput:boostedInput-baseInput, extraOutput:boostedOutput-outAmount, slot:slot};
}

function conditionSpecForBlock(block, slot){
    var resources = acceptedConditionResources(block);
    if(resources[slot] != null){
        var spec = resources[slot];
        var recipe = factoryRecipeSpec(block, spec.resource, slot);
        if(recipe != null) spec.recipe = recipe;
        return spec;
    }
    // Add power only after all real item/liquid inputs have been used, and only once.
    if(slot === resources.length && hasPowerInput(block)) return {mode:'power'};
    return null;
}

function availableConditionSpecs(block){
    var out = [];
    if(block == null) return out;
    var max = 8;
    for(var i = 0; i < max; i++){
        var spec = conditionSpecForBlock(block, i);
        if(spec == null) break;
        out.push(spec);
    }
    return out;
}

function conditionText(spec){
    if(spec == null) return {en:'', pt:'', es:'', vi:''};
    if(spec.mode === 'liquid'){
        var ln = spec.resource != null ? spec.resource.localizedName : 'liquid';
        return {
            en:'Needs ' + ln + ' stored inside.',
            pt:'Precisa de ' + ln + ' guardado dentro.',
            es:'Necesita ' + ln + ' guardado dentro.',
            vi:'Cần có ' + ln + ' bên trong.'
        };
    }
    if(spec.mode === 'item'){
        var inn = spec.resource != null ? spec.resource.localizedName : 'item';
        if(spec.recipe != null){
            var rin = spec.recipe.input.localizedName;
            var rout = spec.recipe.output.localizedName;
            return {
                en:'Factory condition: keep ' + rin + ' available. Recipe becomes ' + spec.recipe.boostedInput + ' ' + rin + ' → ' + spec.recipe.boostedOutput + ' ' + rout + '.',
                pt:'Condição da fábrica: mantenha ' + rin + ' disponível. A receita passa a ser ' + spec.recipe.boostedInput + ' ' + rin + ' → ' + spec.recipe.boostedOutput + ' ' + rout + '.',
                es:'Condición de fábrica: mantén ' + rin + ' disponible. La receta pasa a ser ' + spec.recipe.boostedInput + ' ' + rin + ' → ' + spec.recipe.boostedOutput + ' ' + rout + '.',
                vi:'Điều kiện nhà máy: cần có ' + rin + '. Công thức trở thành ' + spec.recipe.boostedInput + ' ' + rin + ' → ' + spec.recipe.boostedOutput + ' ' + rout + '.'
            };
        }
        return {
            en:'Needs ' + inn + ' loaded as ammo/input.',
            pt:'Precisa de ' + inn + ' carregado como munição/entrada.',
            es:'Necesita ' + inn + ' cargado como munición/entrada.',
            vi:'Cần nạp ' + inn + ' làm đạn/đầu vào.'
        };
    }
    return {
        en:'Needs stable power connected.',
        pt:'Precisa de energia estável ligada.',
        es:'Necesita energía estable conectada.',
        vi:'Cần nguồn điện ổn định.'
    };
}

function turretHasItem(build, item){
    try{
        if(item == null || build == null || build.ammo == null) return false;
        for(var i = 0; i < build.ammo.size; i++){
            var entry = build.ammo.get(i);
            if(entry != null && entry.item === item && entry.amount > 0) return true;
        }
    }catch(e){}
    return false;
}

function conditionSatisfied(build, u){
    if(build == null || u == null || !u.conditional) return true;
    var spec = u.condition;
    if(spec == null || spec.mode === 'none') return false;
    try{
        if(spec.mode === 'power'){
            return build.power != null && build.power.status >= 0.90;
        }
        if(spec.mode === 'liquid'){
            return build.liquids != null && spec.resource != null && build.liquids.get(spec.resource) >= 0.1;
        }
        if(spec.mode === 'item'){
            if(spec.resource == null) return false;
            var cls = classNameOf(build.block).toLowerCase();
            if(cls.indexOf('itemturret') >= 0 || cls.indexOf('turret') >= 0){
                return turretHasItem(build, spec.resource);
            }
            try{
                if(build.items != null && build.block != null && build.block.itemCapacity > 0){
                    return build.items.get(spec.resource) >= 1;
                }
            }catch(e2){}
            return false;
        }
    }catch(e){}
    return false;
}

function conditionStatusText(build, u){
    if(u == null || !u.conditional) return '';
    if(u.condition == null) return '';
    var ok = conditionSatisfied(build, u);
    return ok
        ? tr('CONDITION ACTIVE // BOOST ENABLED', 'CONDICAO ATIVA // BOOST HABILITADO')
        : tr('CONDITION NOT MET // BOOST PAUSED', 'CONDICAO NAO ATENDIDA // BOOST PAUSADO');
}

function makeConditionalUp(id, blockFn, costFn, nameEn, namePt, spec, keys){
    var u = makeUp(id, blockFn, 1, costFn, nameEn, namePt, '', '', keys);
    u.conditional = true;
    u.condition = spec;
    u.boostEach = 0.06;
    var ct = conditionText(spec);
    u.descEn = 'Active while condition is met. +' + Math.round(u.boostEach * 100) + '% efficiency. ' + ct.en;
    u.descPt = 'Ativo enquanto a condição for atendida. +' + Math.round(u.boostEach * 100) + '% eficiência. ' + ct.pt;
    u.descEs = 'Activo mientras se cumple la condición. +' + Math.round(u.boostEach * 100) + '% eficiencia. ' + ct.es;
    u.descVi = 'Hoạt động khi điều kiện được đáp ứng. +' + Math.round(u.boostEach * 100) + '% hiệu suất. ' + ct.vi;
    u.desc = function(lv){ return tr(this.descEn, this.descPt, this.descEs, this.descVi); };
    return u;
}

function conditionalNames(block, index, spec){
    var resource = spec != null && spec.resource != null ? ("" + spec.resource.localizedName) : "";
    var mode = spec == null ? "none" : spec.mode;
    var loc = "Block";
    try{ if(block != null && block.localizedName != null) loc = "" + block.localizedName; }catch(e){}
    var short = loc.length > 14 ? loc.substring(0, 12) + "..." : loc;

    var pools = {
        liquid: {
            en:["Needs Liquid", "Pressure Check", "Reservoir Link", "Wet Circuit", "Flow Gate", "Sump Sensor", "Hydraulic Key", "Liquid Latch"],
            pt:["Precisa de Líquido", "Checagem de Pressão", "Elo do Reservatório", "Circuito Molhado", "Portão de Fluxo", "Sensor do Poço", "Chave Hidráulica", "Trava de Líquido"],
            es:["Necesita Líquido", "Chequeo de Presión", "Enlace de Reservorio", "Circuito Húmedo", "Compuerta de Flujo", "Sensor de Pozo", "Llave Hidráulica", "Pestillo de Líquido"],
            vi:["Cần chất lỏng", "Kiểm tra áp suất", "Liên kết bồn", "Mạch ướt", "Cổng dòng", "Cảm biến hố", "Chìa thủy lực", "Chốt chất lỏng"]
        },
        item: {
            en:["Needs Ammo/Item", "Magazine Check", "Feed Sensor", "Cargo Key", "Hopper Link", "Stock Gate", "Loaded Latch", "Supply Circuit"],
            pt:["Precisa de Munição/Item", "Checagem do Magazine", "Sensor de Carga", "Chave de Carga", "Elo do Hopper", "Portão de Estoque", "Trava Carregada", "Circuito de Suprimento"],
            es:["Necesita Munición/Ítem", "Chequeo de Cargador", "Sensor de Carga", "Llave de Carga", "Enlace de Tolva", "Compuerta de Stock", "Pestillo Cargado", "Circuito de Suministro"],
            vi:["Cần đạn/vật phẩm", "Kiểm tra băng đạn", "Cảm biến nạp", "Chìa hàng", "Liên kết phễu", "Cổng kho", "Chốt đã nạp", "Mạch tiếp tế"]
        },
        power: {
            en:["Needs Power", "Grid Check", "Live Wire", "Watt Sensor", "Bus Key", "Charge Gate", "Voltage Latch", "Network Link"],
            pt:["Precisa de Energia", "Checagem da Rede", "Fio Ao Vivo", "Sensor de Watts", "Chave do Bus", "Portão de Carga", "Trava de Tensão", "Elo da Rede"],
            es:["Necesita Energía", "Chequeo de Red", "Cable Vivo", "Sensor de Vatios", "Llave del Bus", "Compuerta de Carga", "Pestillo de Voltaje", "Enlace de Red"],
            vi:["Cần điện", "Kiểm tra lưới", "Dây có điện", "Cảm biến watt", "Chìa bus", "Cổng sạc", "Chốt điện áp", "Liên kết mạng"]
        },
        none: {
            en:["Ambient Check", "Field Sensor", "Context Key", "Standby Gate", "Presence Latch", "Local Link", "Soft Condition", "Idle Circuit"],
            pt:["Checagem Ambiente", "Sensor de Campo", "Chave de Contexto", "Portão em Espera", "Trava de Presença", "Elo Local", "Condição Suave", "Circuito Ocioso"],
            es:["Chequeo Ambiental", "Sensor de Campo", "Llave de Contexto", "Compuerta en Espera", "Pestillo de Presencia", "Enlace Local", "Condición Suave", "Circuito Inactivo"],
            vi:["Kiểm tra môi trường", "Cảm biến trường", "Chìa ngữ cảnh", "Cổng chờ", "Chốt hiện diện", "Liên kết cục bộ", "Điều kiện mềm", "Mạch chờ"]
        }
    };
    var pool = pools[mode] || pools.none;
    var i = index % pool.en.length;
    var suffix = resource ? (" · " + resource) : "";
    if(spec != null && spec.recipe != null){
        suffix += " · " + spec.recipe.boostedInput + "→" + spec.recipe.boostedOutput;
    }
    return {
        en: short + " — " + pool.en[i] + suffix,
        pt: short + " — " + pool.pt[i] + suffix,
        es: short + " — " + pool.es[i] + suffix,
        vi: short + " — " + pool.vi[i] + suffix
    };
}

function ensureGroupEight(group){
    if(group == null) return;
    var b = group.block();
    if(b == null) return;
    var category = group.category || categoryOfBlock(b);
    group.category = category;
    if(group.upgrades == null) group.upgrades = [];

    var seed = blockSeed(b.name);
    var coreN = rangeCount(seed, 2, 5);           // 2-5 core upgrades
    var availableConds = availableConditionSpecs(b);
    var condN = Math.min(4, availableConds.length); // only real conditions, max 4 for a cleaner UI
    group.coreCount = coreN;
    group.condCount = condN;
    var layout = "v4-" + coreN + "x" + condN;
    var target = coreN + condN;

    if(group.upgrades.length !== target || group._cardLayout !== layout){
        group.upgrades = [];
        group._cardLayout = layout;
        for(var idx = 0; idx < coreN; idx++){
            var names = upgradeNames(category, idx, b);
            var id = genericUpgradeId("" + b.name, idx);
            if(UPGRADES[id] == null){
                UPGRADES[id] = makeUp(id, group.block, 3,
                    (function(blockFn, costIndex){ return function(lv){ return autoCost(blockFn, costIndex, lv); }; })(group.block, idx),
                    names.en, names.pt, "", "", "" + b.name + " " + category + " upgrade improvement speed");
            }
            // Always refresh titles/descriptions (unique per role + language)
            UPGRADES[id].nameEn = names.en;
            UPGRADES[id].namePt = names.pt || names.en;
            UPGRADES[id].nameEs = names.es || names.en;
            UPGRADES[id].nameVi = names.vi || names.en;
            (function(up, cat, blk, ix){
                up.desc = function(lv){ return upgradeDescription(cat, lv, blk, ix); };
            })(UPGRADES[id], category, b, idx);
            group.upgrades.push(id);
        }
        for(var cidx = 0; cidx < condN; cidx++){
            var cid = genericUpgradeId("" + b.name, coreN + cidx);
            var spec = availableConds[cidx];
            if(spec == null) continue;
            var cn = conditionalNames(b, cidx, spec);
            if(UPGRADES[cid] == null){
                UPGRADES[cid] = makeConditionalUp(cid, group.block,
                    (function(blockFn, costIndex){ return function(lv){ return autoCost(blockFn, costIndex + 3, lv); }; })(group.block, cidx),
                    cn.en, cn.pt, spec, "" + b.name + " conditional " + category + " requirement");
            }
            // Refresh conditional titles/descriptions
            UPGRADES[cid].nameEn = cn.en;
            UPGRADES[cid].namePt = cn.pt;
            UPGRADES[cid].nameEs = cn.es || cn.en;
            UPGRADES[cid].nameVi = cn.vi || cn.en;
            UPGRADES[cid].condition = spec;
            var ct = conditionText(spec);
            var pct = Math.round((UPGRADES[cid].boostEach || 0.06) * 100);
            UPGRADES[cid].descEn = "Works only if condition is true. +" + pct + "% efficiency. " + ct.en;
            UPGRADES[cid].descPt = "Só funciona se a condição for verdadeira. +" + pct + "% eficiência. " + ct.pt;
            UPGRADES[cid].descEs = "Solo funciona si la condición es verdadera. +" + pct + "% eficiencia. " + (ct.es || ct.en);
            UPGRADES[cid].descVi = "Chỉ chạy khi điều kiện đúng. +" + pct + "% hiệu suất. " + (ct.vi || ct.en);
            UPGRADES[cid].desc = function(lv){ return tr(this.descEn, this.descPt, this.descEs, this.descVi); };
            group.upgrades.push(cid);
        }
    }
    ensureMasterUpgrades(group);
}

function addGlobalTransportGroup(planet, blocks){
    if(blocks == null || blocks.length === 0) return;
    var key = planet === "erekir" ? "duct-network" : "conveyor-network";
    var group = GLOBAL_TRANSPORT_GROUPS[key];
    if(group != null) return;

    var rep = blocks[0];
    var blockFn = function(){ return rep; };
    var namesEn = planet === "erekir"
        ? ["Pneumatic Acceleration", "Pressure Lanes", "Synchronized Ducts", "High-Flow Chambers", "Duct Overclock", "Jam-Proof Routing", "Cargo Pulse", "Logistics Mastery"]
        : ["Logistics Acceleration", "Reinforced Belts", "Synchronized Lines", "High-Flow Belts", "Conveyor Overclock", "Jam-Proof Routing", "Cargo Pulse", "Logistics Mastery"];
    var namesPt = planet === "erekir"
        ? ["Aceleracao Pneumatica", "Linhas Pressurizadas", "Dutos Sincronizados", "Camara de Alto Fluxo", "Overclock de Dutos", "Roteamento Anti-Trava", "Pulso de Carga", "Maestria Logistica"]
        : ["Aceleracao Logistica", "Esteiras Reforcadas", "Linhas Sincronizadas", "Esteiras de Alto Fluxo", "Overclock de Esteiras", "Roteamento Anti-Trava", "Pulso de Carga", "Maestria Logistica"];
    var ids = [];
    for(var i = 0; i < 8; i++){
        var id = i === 0 ? key : key + "-" + (i + 1);
        ids.push(id);
        if(UPGRADES[id] == null){
            (function(upId, index){
                UPGRADES[upId] = makeGlobalUp(upId, blockFn, index === 0 ? 5 : 1,
                    function(lv){
                        if(planet === "erekir") return [[Items.beryllium, 180 + index * 55 + lv * 110],[Items.graphite, 100 + index * 40 + lv * 65]];
                        return [[Items.copper, 180 + index * 55 + lv * 110],[Items.lead, 100 + index * 40 + lv * 65]];
                    },
                    namesEn[index], namesPt[index],
                    planet === "erekir"
                        ? "Global upgrade: every Erekir duct receives +10% transport throughput per installed rank. No installation is required."
                        : "Global upgrade: every Serpulo conveyor receives +10% transport throughput per installed rank. No installation is required.",
                    planet === "erekir"
                        ? "Upgrade global: todos os dutos de Erekir recebem +10% de fluxo por nivel instalado. Nao precisa instalar."
                        : "Upgrade global: todas as esteiras de Serpulo recebem +10% de fluxo por nivel instalado. Nao precisa instalar.",
                    planet + " transport conveyor duct logistics speed global", planet === "erekir" ? "erekir-transport" : "serpulo-transport");
            })(id, i);
        }
    }
    group = {
        titleEn: planet === "erekir" ? "Duct Network" : "Conveyor Network",
        titlePt: planet === "erekir" ? "Rede de Dutos" : "Rede de Esteiras",
        globalTransport: true,
        dynamicTitle: true,
        block: blockFn,
        upgrades: ids,
        planet: planet,
        category: "distribution",
        transportBlocks: []
    };
    for(var j = 0; j < blocks.length; j++){
        group.transportBlocks.push("" + blocks[j].name);
        GLOBAL_TRANSPORT_BY_BLOCK["" + blocks[j].name] = ids;
    }
    GLOBAL_TRANSPORT_GROUPS[key] = group;
    GROUPS.push(group);
}


// Per-conveyor / per-duct global upgrades (same card style as network globals)
function addPerConveyorGlobalGroup(block){
    if(block == null || block.name == null) return;
    var bname = "" + block.name;
    var key = "conv-type-" + safePart(bname);
    if(GLOBAL_TRANSPORT_GROUPS[key] != null) return;

    var blockFn = function(){ return block; };
    var loc = block.localizedName != null ? ("" + block.localizedName) : bname;
    var isDuct = ("" + bname).toLowerCase().indexOf("duct") >= 0 || planetKeyForBlock(block) === "erekir";
    var namesEn = isDuct
        ? [loc + " Flow Tune", loc + " Pressure Seal", loc + " Sync Lanes", loc + " Burst Chamber", loc + " Line Overclock", loc + " Anti-Jam", loc + " Cargo Pulse", loc + " Mastery"]
        : [loc + " Belt Tune", loc + " Reinforced Links", loc + " Sync Timing", loc + " High-Flow", loc + " Line Overclock", loc + " Anti-Jam", loc + " Cargo Pulse", loc + " Mastery"];
    var namesPt = isDuct
        ? ["Ajuste de Fluxo (" + loc + ")", "Vedacao (" + loc + ")", "Faixas Sync (" + loc + ")", "Camara Burst (" + loc + ")", "Overclock (" + loc + ")", "Anti-Trava (" + loc + ")", "Pulso (" + loc + ")", "Maestria (" + loc + ")"]
        : ["Ajuste de Esteira (" + loc + ")", "Elos Reforcados (" + loc + ")", "Tempo Sync (" + loc + ")", "Alto Fluxo (" + loc + ")", "Overclock (" + loc + ")", "Anti-Trava (" + loc + ")", "Pulso (" + loc + ")", "Maestria (" + loc + ")"];

    var ids = [];
    for(var i = 0; i < 8; i++){
        var id = i === 0 ? key : key + "-" + (i + 1);
        ids.push(id);
        if(UPGRADES[id] == null){
            (function(upId, index, nmEn, nmPt){
                UPGRADES[upId] = makeGlobalUp(upId, blockFn, index === 0 ? 5 : 1,
                    function(lv){
                        if(isDuct) return [[Items.beryllium, 90 + index * 35 + lv * 70],[Items.graphite, 50 + index * 25 + lv * 40]];
                        return [[Items.copper, 90 + index * 35 + lv * 70],[Items.lead, 50 + index * 25 + lv * 40]];
                    },
                    nmEn, nmPt,
                    "Team upgrade for " + loc + ": +8% throughput per rank. Your team blocks become an optimized class; other teams stay vanilla.",
                    "Upgrade de time para " + loc + ": +8% de fluxo por nivel. Blocos do seu time viram classe otimizada; outros times ficam vanilla.",
                    bname + " transport conveyor duct " + loc + " global specific",
                    isDuct ? "erekir-transport" : "serpulo-transport");
            })(id, i, namesEn[i], namesPt[i]);
        }
    }

    var group = {
        titleEn: loc + " (Team NT)",
        titlePt: loc + " (Time NT)",
        globalTransport: true,
        dynamicTitle: true,
        perConveyor: true,
        block: blockFn,
        upgrades: ids,
        planet: planetKeyForBlock(block),
        category: "distribution",
        transportBlocks: [bname]
    };
    GLOBAL_TRANSPORT_GROUPS[key] = group;
    GROUPS.push(group);

    // Stack with network-wide IDs if already present
    var prev = GLOBAL_TRANSPORT_BY_BLOCK[bname];
    if(prev == null) GLOBAL_TRANSPORT_BY_BLOCK[bname] = ids.slice();
    else {
        var merged = prev.slice();
        for(var m = 0; m < ids.length; m++){
            if(merged.indexOf(ids[m]) < 0) merged.push(ids[m]);
        }
        GLOBAL_TRANSPORT_BY_BLOCK[bname] = merged;
    }
}


function appendSignatureUpgrades(group, block){
    if(group == null || block == null || group.upgrades == null) return;
    var n = (""+block.name).toLowerCase();
    var extras = [];
    if(n === "duo"){
        extras.push({id:"sig-duo-volley", en:"Twin Volley", pt:"Rajada Gemea", descEn:"+12% fire rate when installed.", descPt:"+12% cadencia ao instalar."});
        extras.push({id:"sig-duo-focus", en:"Focus Lens", pt:"Lente de Foco", descEn:"+8% range. Exclusive Duo tech.", descPt:"+8% alcance. Tech exclusiva do Duo."});
    }else if(n === "scatter"){
        extras.push({id:"sig-scatter-flak", en:"Flak Pattern", pt:"Padrao Flak", descEn:"Anti-air specialist: +10% damage.", descPt:"Anti-aereo: +10% dano."});
    }else if(n === "mechanical-drill" || n === "pneumatic-drill"){
        extras.push({id:"sig-drill-pulse", en:"Pulse Extractor", pt:"Extrator de Pulso", descEn:"+10% drill speed. Signature mining tech.", descPt:"+10% velocidade. Tech exclusiva de mineracao."});
    }else if(n === "silicon-smelter"){
        extras.push({id:"sig-silicon-pure", en:"Pure Silicon Cycle", pt:"Ciclo de Silicio Puro", descEn:"Signature smelter tech.", descPt:"Tech exclusiva da fundicao de silicio."});
    }else if(n === "arc"){
        extras.push({id:"sig-arc-chain", en:"Chain Surge", pt:"Surto em Cadeia", descEn:"+10% damage. Exclusive Arc tech.", descPt:"+10% dano. Tech exclusiva do Arc."});
    }else if(n === "hail"){
        extras.push({id:"sig-hail-barrage", en:"Barrage Protocol", pt:"Protocolo Rajada", descEn:"+10% rate of fire.", descPt:"+10% cadencia."});
    }
    for(var i = 0; i < extras.length; i++){
        var ex = extras[i];
        if(UPGRADES[ex.id] != null) continue;
        (function(exRef, blk){
            UPGRADES[exRef.id] = {
                id: exRef.id,
                block: function(){ return blk; },
                maxLevel: 1,
                max: 1,
                cost: function(lv){ return [[Items.copper, 120],[Items.lead, 80]]; },
                nameEn: exRef.en,
                namePt: exRef.pt,
                descEn: exRef.descEn,
                descPt: exRef.descPt,
                name: function(){ return tr(this.nameEn, this.namePt); },
                desc: function(lv){ return tr(this.descEn, this.descPt); },
                keys: n + " signature exclusive",
                boost: 0.10,
                installable: true
            };
        })(ex, block);
        group.upgrades.push(ex.id);
    }
}

function ensureCatalogBuilt(){
    if(catalogBuilt) return;
    if(Vars.content == null || Vars.content.blocks == null) return;

    BLOCK_GROUPS = {};
    CATEGORY_GROUPS = {};
    GLOBAL_TRANSPORT_BY_BLOCK = {};
    GLOBAL_TRANSPORT_GROUPS = {};

    // Keep legacy groups/IDs intact, but attach each one to the real block category.
    for(var g = 0; g < GROUPS.length; g++){
        var legacy = GROUPS[g];
        try{
            var lb = legacy.block();
            if(lb != null){
                legacy.category = categoryOfBlock(lb);
                BLOCK_GROUPS["" + lb.name] = legacy;
            }
        }catch(e){}
    }

    var serpuloTransport = [];
    var erekirTransport = [];
    Vars.content.blocks().each(function(b){
        try{
            if(b == null || b.name == null || !b.logicVisible()) return;
            var name = "" + b.name;
            var category = categoryOfBlock(b);
            if(isTransportBlock(b)){
                var pk = planetKeyForBlock(b);
                var lname = name.toLowerCase();
                if(pk === "erekir" || lname.indexOf("duct") >= 0) erekirTransport.push(b);
                else serpuloTransport.push(b);
                return;
            }

            var group = BLOCK_GROUPS[name];
            if(group == null){
                (function(block, cat){
                    group = {
                        titleEn: "",
                        titlePt: "",
                        dynamicTitle: true,
                        block: function(){ return block; },
                        upgrades: [],
                        planet: planetKeyForBlock(block),
                        category: cat
                    };
                })(b, category);
                GROUPS.push(group);
                BLOCK_GROUPS[name] = group;
            }else{
                group.category = category;
                if(group.planet == null) group.planet = planetKeyForBlock(b);
            }
            ensureGroupEight(group);
        }catch(err){}
    });

    // addGlobalTransportGroup serpulo disabled
    // addGlobalTransportGroup erekir disabled

    // Distribution removed — no per-conveyor cards

    for(var cg = 0; cg < CATEGORY_ORDER.length; cg++) CATEGORY_GROUPS[CATEGORY_ORDER[cg]] = [];
    try{
        for(var si = 0; si < GROUPS.length; si++){
            var sg = GROUPS[si];
            if(sg != null && sg.block != null) appendSignatureUpgrades(sg, sg.block());
        }
    }catch(eSig){}

    // Drop distribution groups entirely
    var filteredGroups = [];
    for(var fi = 0; fi < GROUPS.length; fi++){
        var fg = GROUPS[fi];
        if(fg == null) continue;
        var fcat = fg.category || (fg.block != null ? categoryOfBlock(fg.block()) : "");
        if(fcat === "distribution") continue;
        filteredGroups.push(fg);
    }
    GROUPS = filteredGroups;

    for(var gi = 0; gi < GROUPS.length; gi++){
        var gg = GROUPS[gi];
        if(gg == null || gg.block == null) continue;
        var cat = gg.category || categoryOfBlock(gg.block());
        if(cat === "distribution") continue;
        if(CATEGORY_GROUPS[cat] == null) CATEGORY_GROUPS[cat] = [];
        CATEGORY_GROUPS[cat].push(gg);
    }
    try{ buildBulletCatalog(); }catch(eB){ Log.err("New Tech's bullet catalog: " + eB); }
    try{ applyAllBulletUpgrades(); }catch(eA){}
    catalogBuilt = true;
}

function groupTitle(g){
    if(g == null) return tr("Unknown", "Desconhecido");
    if(g.bulletGroup){
        if(g.isUnitBullet && g.unitType != null){
            return tr("BULLET // " + g.unitType.localizedName, "TIRO // " + g.unitType.localizedName);
        }
        if(g.titleEn != null) return tr(g.titleEn, g.titlePt || g.titleEn);
    }
    var b = g.block != null ? g.block() : null;
    if(g.globalTransport){
        if(g.perConveyor){
            var ploc = b != null && b.localizedName != null ? ("" + b.localizedName) : "Transport";
            return tr("LOGISTICS // " + ploc, "LOGISTICA // " + ploc);
        }
        return g.planet === "erekir"
            ? tr("LOGISTICS // DUCT NETWORK", "LOGISTICA // REDE DE DUTOS")
            : tr("LOGISTICS // CONVEYOR NETWORK", "LOGISTICA // REDE DE ESTEIRAS");
    }
    if(b == null) return tr("Unknown Block", "Bloco Desconhecido");
    var cat = g.category || categoryOfBlock(b);
    return tr((CATEGORY_LABELS_EN[cat] || "SYSTEM") + " // " + b.localizedName, (CATEGORY_LABELS_PT[cat] || "SISTEMA") + " // " + b.localizedName);
}

function currentPlanetName(){
    try{
        var p = currentPlanetObject();
        if(p != null && p.name != null) return "" + p.name;
    }catch(e){}
    return "";
}


function groupDisplayName(g){
    if(g == null) return "?";
    try{
        if(g.bulletGroup){
            if(g.ammoGroup && g.block != null) return "" + g.block().localizedName;
            if(g.isUnitBullet && g.unitType != null) return "" + g.unitType.localizedName;
            if(g.titleEn != null){
                // prefer localized unit/block title without suffix noise
                var b = g.block != null ? g.block() : null;
                if(b != null && !g.isUnitBullet) return "" + b.localizedName;
                return L({en: g.titleEn, pt: g.titlePt || g.titleEn, es: g.titleEn, vi: g.titleEn});
            }
        }
        if(g.globalTransport) return groupTitle(g);
        if(g.block != null){
            var bb = g.block();
            if(bb != null) return "" + bb.localizedName;
        }
    }catch(e){}
    return groupTitle(g);
}

function groupVisible(g){
    if(g == null) return false;
    // Unit bullet groups: filter by planet (Sun = all)
    if(g.bulletGroup && g.isUnitBullet){
        if(g.unitType == null) return false;
        return unitOnCurrentPlanet(g.unitType);
    }
    if(g.block == null) return false;
    var b = g.block();
    if(b == null) return false;
    // Campaign: only blocks already researched/unlocked by the player
    if(isCampaign() && !g.globalTransport){
        try{
            if(b.unlocked == null || !b.unlocked()) return false;
        }catch(eU){
            try{ if(b.locked && b.locked()) return false; }catch(e2){}
        }
    }
    // Ammo is a content catalogue, not a build-visibility catalogue.
    // Do not hide valid ammo groups just because a turret is not exposed to Logic.
    if(g.globalTransport){
        var pn = currentPlanetName().toLowerCase();
        // Sun is the combined planet view: include both Serpulo and Erekir logistics.
        if(pn === "sun") return true;
        return pn === ("" + g.planet).toLowerCase() || pn === "" || pn === "custom";
    }
    if(g.bulletGroup) return blockVisibleNow(b);
    return blockVisibleNow(b) && blockOnCurrentPlanet(b);
}

function costText(stacks){
    if(stacks.length === 0) return "-";
    var parts = [];
    for(var i = 0; i < stacks.length; i++) parts.push(stacks[i][1] + " " + stacks[i][0].localizedName);
    return parts.join(" + ");
}

function findCore(){
    if(Vars.state != null && Vars.state.isGame() && Vars.player != null){
        var core = Vars.player.core();
        if(core != null) return core;
        var team = Vars.player.team();
        if(team != null && team.cores != null && team.cores.size > 0) return team.cores.first();
    }
    return null;
}

function researchCores(){
    var out = [];
    try{
        if(Vars.player != null){
            var team = Vars.player.team();
            if(team != null && team.cores != null){
                for(var i = 0; i < team.cores.size; i++){
                    var c = team.cores.get(i);
                    if(c != null && c.isValid() && out.indexOf(c) < 0) out.push(c);
                }
            }
            var pc = Vars.player.core();
            if(pc != null && pc.isValid() && out.indexOf(pc) < 0) out.unshift(pc);
        }
    }catch(e){}
    if(out.length === 0){
        var fallback = findCore();
        if(fallback != null) out.push(fallback);
    }
    return out;
}
function coreList(coreOrCores){
    if(coreOrCores == null) return [];
    if(coreOrCores.length != null && coreOrCores.items == null) return coreOrCores;
    return [coreOrCores];
}
function totalResearchItems(coreOrCores, item){
    var cores = coreList(coreOrCores);
    var total = 0;
    for(var i = 0; i < cores.length; i++){
        try{ if(cores[i] != null && cores[i].items != null) total += cores[i].items.get(item)|0; }catch(e){}
    }
    return total;
}
function hasAny(coreOrCores, stacks){
    var cores = coreList(coreOrCores);
    if(cores.length === 0) return false;
    for(var i = 0; i < stacks.length; i++){
        if(stacks[i][1] > 0 && totalResearchItems(cores, stacks[i][0]) > 0) return true;
    }
    return false;
}
function canFull(coreOrCores, stacks){
    var cores = coreList(coreOrCores);
    if(cores.length === 0) return false;
    for(var i = 0; i < stacks.length; i++){
        if(totalResearchItems(cores, stacks[i][0]) < stacks[i][1]) return false;
    }
    return true;
}
function payStacks(coreOrCores, stacks){
    var cores = coreList(coreOrCores);
    for(var i = 0; i < stacks.length; i++){
        var need = stacks[i][1]|0;
        for(var c = 0; c < cores.length && need > 0; c++){
            var core = cores[c];
            if(core == null || core.items == null) continue;
            var have = core.items.get(stacks[i][0])|0;
            var pay = Math.min(have, need)|0;
            if(pay > 0){
                core.items.remove(stacks[i][0], pay);
                need -= pay;
            }
        }
    }
}

function contributeResearch(u){
    var lv = levelOf(u.id);
    if(lv >= u.max) return false;
    var cores = researchCores();
    if(cores.length === 0) return false;
    var rem = remainingCost(u);
    if(rem.length === 0){ setLevel(u.id, lv+1); clearPartial(u.id); return true; }
    if(!hasAny(cores, rem)) return false;

    var partial = getPartial(u.id);
    var full = u.cost(lv + 1);
    for(var i = 0; i < rem.length; i++){
        var it = rem[i][0];
        var need = rem[i][1];
        var available = totalResearchItems(cores, it);
        var pay = Math.min(available|0, need|0)|0;
        if(pay > 0){
            var left = pay;
            for(var ci = 0; ci < cores.length && left > 0; ci++){
                var core = cores[ci];
                if(core == null || core.items == null) continue;
                var have = core.items.get(it)|0;
                var take = Math.min(have, left)|0;
                if(take > 0){
                    core.items.remove(it, take);
                    left -= take;
                }
            }
            var fullAmt = 0;
            for(var j = 0; j < full.length; j++) if(full[j][0] === it) fullAmt += full[j][1];
            partial[it.name] = ((fullAmt - need) + pay)|0;
        }
    }
    setPartial(u.id, partial);
    if(remainingCost(u).length === 0){
        setLevel(u.id, lv + 1);
        clearPartial(u.id);
    }
    return true;
}

function norm(s){
    if(s == null) return "";
    return (""+s).toLowerCase()
        .replace(/[áàãâä]/g,"a").replace(/[éèêë]/g,"e")
        .replace(/[íìîï]/g,"i").replace(/[óòõôö]/g,"o")
        .replace(/[úùûü]/g,"u").replace(/ç/g,"c");
}

function matches(u, gTitle, block, query){
    if(!query) return true;
    var q = norm(query);
    var blob = norm(upgradeDisplayName(u) + " " + gTitle + " " + u.keys + " " + (block != null ? block.localizedName : "") + " " + u.id + " " + (u.globalKind || ""));
    if(blob.indexOf(q) >= 0) return true;
    var parts = blob.split(/[\s\-_]+/);
    for(var i = 0; i < parts.length; i++) if(parts[i].indexOf(q) === 0) return true;
    return false;
}

function globalTransportRankForBlock(block){
    ensureCatalogBuilt();
    if(block == null) return 0;
    var ids = GLOBAL_TRANSPORT_BY_BLOCK["" + block.name];
    if(ids == null) return 0;
    var total = 0;
    for(var i = 0; i < ids.length; i++) total += levelOf(ids[i]);
    return total;
}

function upgradesForBlock(block){
    ensureCatalogBuilt();
    if(block == null) return [];
    var g = BLOCK_GROUPS["" + block.name];
    if(g == null || g.globalTransport) return [];
    var list = [];
    for(var i = 0; i < g.upgrades.length; i++){
        var u = UPGRADES[g.upgrades[i]];
        if(u != null) list.push(u);
    }
    return list;
}

function researchedCount(group){
    if(group == null || group.upgrades == null) return 0;
    var count = 0;
    for(var i = 0; i < group.upgrades.length; i++) if(levelOf(group.upgrades[i]) > 0) count++;
    return count;
}

function showBlockResearchDialog(group, returnCategory, restoreScrollY){
    ensureCatalogBuilt();
    var block = group != null ? group.block() : null;
    if(group == null || block == null) return;

    var dialog = new BaseDialog(groupTitle(group));
    var body = new Table();
    body.defaults().pad(5).growX();

    body.table(Styles.none, function(head){
        head.button(tr("Back", "Voltar"), Icon.left, function(){
            dialog.hide();
            showCategoryDialog(returnCategory);
        }).size(Vars.mobile ? 120 : 150, 44);
        head.add("[accent]" + groupDisplayName(group)).growX().wrap().padLeft(8);
    }).growX().row();

    var coreN = group.coreCount != null ? group.coreCount : 5;
    var condN = group.condCount != null ? group.condCount : 4;
    var masterN = group.masterCount != null ? group.masterCount : (group.masterUpgrades != null ? group.masterUpgrades.length : 3);
    body.add("[lightgray]" + coreN + " core / " + condN + " cond / " + masterN + " master").row();
    body.add("[accent]CORE // " + coreN).padTop(4).row();
    var printedCondHeader = false;
    var researchPane = null;
    for(var i = 0; i < group.upgrades.length; i++){
        (function(u){
            if(u.conditional && !printedCondHeader){
                body.add("[yellow]COND // " + condN).padTop(6).row();
                printedCondHeader = true;
            }
            var lv = levelOf(u.id);
            var maxed = lv >= u.max;
            var rem = remainingCost(u);
            var core = researchCores();
            var canFullPay = !maxed && canFull(core, rem);
            var hasResources = !maxed && hasAny(core, rem);
            var global = !!u.globalResearch;
            var card = body.table(Tex.pane, function(tbl){
                tbl.left().defaults().left().pad(u.conditional ? 4 : 3);
                tbl.add("[white]" + upgradeDisplayName(u)).growX().wrap().row();
                tbl.add("[lightgray]" + upgradeDisplayDesc(u, lv > 0 ? lv : 1)).growX().wrap().row();
                // Every card gets a small dev note, including conditional and ammo cards.
                var devNote = developerNote(u);
                if(devNote != null) tbl.add("[gray]" + tr(devNote.en, devNote.pt)).growX().wrap().padTop(Vars.mobile ? 1 : 0).padBottom(Vars.mobile ? 2 : 0).row();
                tbl.add("[gray]" + tr("Rank ", "Nível ") + lv + "/" + u.max).row();
                if(global) tbl.add("[accent]" + tr("TEAM NETWORK", "REDE DO TIME")).row();
                if(u.conditional){
                    var ct = conditionText(u.condition);
                    tbl.add("[yellow]" + tr("WHEN: ", "QUANDO: ") + tr(ct.en, ct.pt)).wrap().row();
                }
                if(maxed){
                    tbl.add("[lime]" + tr("MAXIMUM RESEARCHED", "PESQUISA MAXIMA")).wrap().row();
                }else{
                    tbl.add((hasResources ? "[lightgray]" : "[scarlet]") + costText(rem)).wrap().row();
                    if(!hasResources) tbl.add("[scarlet]" + tr("Not enough resources", "Recursos insuficientes")).row();
                }
                var label = maxed ? tr("Maxed", "Maximo") : (canFullPay ? tr("Research", "Pesquisar") : tr("Pay", "Pagar"));
                tbl.button(label, Icon.book, function(){
                    var keepScrollY = 0;
                    try{ keepScrollY = researchPane.getScrollY(); }catch(e){}
                    var currentLv = levelOf(u.id);
                    var changed = false;
                    if(currentLv < u.max){
                        changed = tryResearchNow(u);
                        if(!changed){
                            quietInfo(tr("Research needs the required items in your team's cores.", "A pesquisa precisa dos recursos necessários nos nucleos do seu time."));
                        }
                    }
                    if(changed && u.ammoResearch){
                        try{ NewTechAmmo.refreshUpgrade(u.id); }catch(eAmmoClick){}
                    }
                    dialog.hide();
                    Core.app.post(function(){ showBlockResearchDialog(group, returnCategory, keepScrollY); });
                }).disabled(maxed).size(Vars.mobile ? 150 : 175, 44).padTop(3);
            }).growX().row();
        })(UPGRADES[group.upgrades[i]]);
    }

    if(group.masterUpgrades != null && group.masterUpgrades.length > 0){
        body.add("[accent]★ MASTER // " + masterN).padTop(6).row();
        for(var mi = 0; mi < group.masterUpgrades.length; mi++){
            (function(u){
                ensureMasterMission(u, group.block != null ? group.block() : null, mi);
                var lv = levelOf(u.id);
                var maxed = lv >= u.max;
                var rem = remainingCost(u);
                var core = researchCores();
                var canFullPay = !maxed && canFull(core, rem);
                var hasResources = !maxed && hasAny(core, rem);
                var missionDone = isMasterMissionComplete(u.id);
                var mp = getMasterMissionProgress(u.id);
                var mt = getMasterMissionTarget(u.id);
                var mfrac = mt > 0 ? Math.min(1, mp / mt) : 0;
                body.table(Tex.pane, function(tbl){
                    tbl.left().defaults().left().pad(3);
                    tbl.add("[accent]★ " + upgradeDisplayName(u)).growX().wrap().row();
                    tbl.add("[lightgray]" + upgradeDisplayDesc(u, 1)).growX().wrap().row();
                    // Mission objective
                    tbl.add("[#ffd54f]" + tr("Mission: ", "Missão: ") + masterMissionLabel(u.id)).growX().wrap().row();
                    // Mission progress bar (text bar for mobile reliability)
                    var barM = progressBarText(mfrac, missionDone);
                    tbl.add(barM + " [lightgray]" + mp + "/" + mt).growX().row();
                    if(missionDone) tbl.add("[lime]" + tr("Mission complete — pay resources to unlock", "Missão completa — pague recursos para desbloquear")).wrap().row();
                    else tbl.add("[gray]" + tr("Finish the mission before researching", "Conclua a missão antes de pesquisar")).wrap().row();
                    // Resource progress bar
                    var rfrac = resourceProgressFraction(rem, core);
                    tbl.add(progressBarText(rfrac, canFullPay) + " [lightgray]" + tr("Resources", "Recursos")).growX().row();
                    if(maxed) tbl.add("[lime]" + tr("Unlocked", "Desbloqueado")).row();
                    else {
                        tbl.add((hasResources ? "[lightgray]" : "[scarlet]") + costText(rem)).wrap().row();
                        if(!hasResources) tbl.add("[scarlet]" + tr("Not enough resources", "Recursos insuficientes")).row();
                    }
                    tbl.button(maxed ? tr("Unlocked", "Desbloqueado") : (canFullPay && missionDone ? tr("Research", "Pesquisar") : (missionDone ? tr("Pay", "Pagar") : tr("Locked", "Bloqueado"))), Icon.star, function(){
                        var keepScrollY = 0;
                        try{ keepScrollY = researchPane.getScrollY(); }catch(e){}
                        if(!isMasterMissionComplete(u.id)){
                            quietInfo(tr("Complete the mission first.", "Conclua a missão primeiro."));
                            return;
                        }
                        var currentLv = levelOf(u.id);
                        var changed = false;
                        if(currentLv < u.max){
                            changed = tryResearchNow(u);
                            if(!changed){
                                quietInfo(tr("Research needs the required items in your team's cores.", "A pesquisa precisa dos recursos necessários nos nucleos do seu time."));
                            }
                        }
                        dialog.hide();
                        Core.app.post(function(){ showBlockResearchDialog(group, returnCategory, keepScrollY); });
                    }).disabled(maxed || !missionDone).size(Vars.mobile ? 150 : 175, 44).padTop(3);
                }).growX().row();
            })(MASTER_UPGRADES[group.masterUpgrades[mi]]);
        }
    }

    dialog.addCloseButton();
    researchPane = dialog.cont.pane(body).grow().pad(8).get();
    dialog.buttons.button(tr("Cancel", "Cancelar"), Icon.cancel, function(){
        dialog.hide();
    }).size(Vars.mobile ? 130 : 110, 42);
    dialog.show();
    if(restoreScrollY != null){
        try{
            Core.app.post(function(){
                try{ researchPane.setScrollY(restoreScrollY); }catch(e){}
            });
        }catch(e){}
    }
}

function showCategoryDialog(category){
    ensureCatalogBuilt();
    var dialog = new BaseDialog(catLabel(category));
    var query = {v:""};
    var list = new Table();

    function rebuild(){
        list.clearChildren();
        var groups = CATEGORY_GROUPS[category] || [];
        var filtered = [];
        for(var i = 0; i < groups.length; i++){
            var g = groups[i];
            if(!groupVisible(g)) continue;
            var disp = groupDisplayName(g);
            if(query.v && norm(disp + " " + groupTitle(g) + " " + category).indexOf(norm(query.v)) < 0) continue;
            filtered.push(g);
        }
        filtered.sort(function(a, b){ return groupDisplayName(a).localeCompare(groupDisplayName(b)); });

        if(filtered.length === 0){
            list.add("[lightgray]" + tr("No blocks in this section.", "Nenhum bloco nesta secao.")).pad(16).row();
            return;
        }
        try{
            filtered.sort(function(a, b){
                var an = "", bn = "";
                try{ if(a.block != null) an = ""+a.block().name; }catch(e1){}
                try{ if(b.block != null) bn = ""+b.block().name; }catch(e2){}
                var af = isFavoriteBlock(an) ? 0 : 1;
                var bf = isFavoriteBlock(bn) ? 0 : 1;
                return af - bf;
            });
        }catch(eSort){}
        for(var j = 0; j < filtered.length; j++){
            (function(g){
                var display = groupDisplayName(g);
                var bname = "";
                try{ if(g.block != null) bname = ""+g.block().name; }catch(eN){}
                var fav = isFavoriteBlock(bname);
                var researched = researchedCount(g);
                var totalCards = (g.upgrades != null ? g.upgrades.length : 0) + (g.masterUpgrades != null ? g.masterUpgrades.length : 0);
                var tag = g.globalTransport ? tr("TEAM NT", "TIME NT") : (researched + "/" + (g.upgrades != null ? g.upgrades.length : 0));
                if(g.bulletGroup){
                    var btag = researched + "/" + (g.upgrades != null ? g.upgrades.length : 0) + "  [accent]BULLET";
                    if(g.isUnitBullet && g.unitType != null){
                        btag += "  [gray]" + ("" + unitPlanetKey(g.unitType)).toUpperCase();
                    }else if(g.block != null){
                        try{ btag += "  [gray]" + planetLabelForBlock(g.block()); }catch(eP){}
                    }
                    tag = btag;
                }
                if(fav) tag = "[#ffd54f]★ " + tag;
                if(researched >= 3) tag += "  [#ce93d8]" + tr("COMBO", "COMBO");
                list.table(Tex.button, function(tbl){
                    tbl.left().defaults().left().pad(3);
                    tbl.table(Styles.none, function(row){
                        row.add((fav ? "[#ffd54f]" : "[white]") + display).growX().wrap();
                        // Icon.star does not exist in Mindustry — use text star
                        row.button(fav ? "[#ffd54f]★" : "[lightgray]☆", Styles.cleart, function(){
                            if(bname) toggleFavoriteBlock(bname);
                            rebuild();
                        }).size(40, 36);
                    }).growX().row();
                    tbl.add("[gray]" + tag).row();
                    tbl.button(tr("Open", "Abrir"), Icon.book, function(){
                        dialog.hide();
                        showBlockResearchDialog(g, category);
                    }).size(Vars.mobile ? 155 : 175, 44).padTop(2);
                }).growX().row();
            })(filtered[j]);
        }
    }

    dialog.addCloseButton();
    dialog.cont.table(Styles.none, function(top){
        top.button(tr("Back", "Voltar"), Icon.left, function(){
            dialog.hide();
            showResearchDialog();
        }).size(Vars.mobile ? 120 : 150, 44);
        top.add("[accent]" + catLabel(category)).growX().padLeft(8).row();
        top.table(Tex.underline, function(search){
            search.image(Icon.zoom).size(22).pad(4);
            var field = search.field("", function(txt){ query.v = txt == null ? "" : txt; rebuild(); }).growX().height(40).get();
            field.setMessageText(tr("Search blocks...", "Pesquisar blocos..."));
        }).growX().height(46).pad(4).row();
    }).growX().row();
    dialog.cont.pane(list).grow().pad(6);
    rebuild();
    dialog.show();
}

function categoryBlockCount(category){
    ensureCatalogBuilt();
    var groups = CATEGORY_GROUPS[category] || [];
    var count = 0;
    for(var i = 0; i < groups.length; i++) if(groupVisible(groups[i])) count++;
    return count;
}



// ---------- History ----------
function currentUserName(){
    try{
        if(Vars.player != null && Vars.player.name != null) return "" + Vars.player.name;
    }catch(e){}
    return "local";
}

function loadHistory(){
    try{
        var s = Core.settings.getString(HISTORY_KEY, "[]");
        upgradeHistory = JSON.parse(s);
        if(upgradeHistory == null || !(upgradeHistory instanceof Array)) upgradeHistory = [];
    }catch(e){ upgradeHistory = []; }
}

function saveHistory(){
    try{
        while(upgradeHistory.length > HISTORY_MAX) upgradeHistory.shift();
        Core.settings.put(HISTORY_KEY, JSON.stringify(upgradeHistory));
    }catch(e){}
}

function pushHistory(entry){
    try{
        entry.t = Time != null ? Time.millis() : java.lang.System.currentTimeMillis();
        if(entry.user == null) entry.user = currentUserName();
        upgradeHistory.push(entry);
        saveHistory();
    }catch(e){}
}

function minutesAgo(ms){
    try{
        var now = Time != null ? Time.millis() : java.lang.System.currentTimeMillis();
        var d = Math.max(0, (now - ms) / 60000);
        if(d < 1) return tr("< 1 min", "< 1 min");
        return Math.floor(d) + " " + tr("min ago", "min atras");
    }catch(e){ return "?"; }
}

function showHistoryDialog(){
    loadHistory();
    var dialog = new BaseDialog(tr("HISTORY", "HISTORICO"));
    dialog.addCloseButton();
    var body = new Table();
    body.defaults().pad(4).growX();
    if(upgradeHistory.length === 0){
        body.add("[lightgray]" + tr("No upgrades recorded yet.", "Nenhuma melhoria registrada ainda.")).pad(12).row();
    }else{
        for(var i = upgradeHistory.length - 1; i >= 0; i--){
            (function(e){
                body.table(Tex.button, function(tbl){
                    tbl.left().defaults().left().pad(2);
                    tbl.add("[accent]" + (e.user || "?") + "  [gray]" + minutesAgo(e.t)).growX().row();
                    tbl.add("[white]" + (e.action || "")).growX().wrap().row();
                    tbl.add("[lightgray]" + (e.block || "?") + (e.pos ? ("  @ " + e.pos) : "")).growX().wrap().row();
                    if(e.detail) tbl.add("[gray]" + e.detail).growX().wrap().row();
                }).growX().row();
            })(upgradeHistory[i]);
        }
    }
    dialog.cont.pane(body).grow().pad(6);
    dialog.show();
}

// ---------- Multiplayer sync ----------
function buildSyncPayload(){
    ensurePersistentState();
    return JSON.stringify({
        v: 1,
        levels: persistentLevels,
        partial: persistentPartial
    });
}

function applySyncPayload(str){
    try{
        var data = JSON.parse(str);
        if(data == null || data.levels == null) return;
        ensurePersistentState();
        // Host/client merge: take max level per id
        var ids = Object.keys(data.levels);
        for(var i = 0; i < ids.length; i++){
            var id = ids[i];
            var incoming = data.levels[id]|0;
            var cur = persistentLevels[id]|0;
            if(incoming > cur) persistentLevels[id] = incoming;
        }
        if(data.partial != null){
            var pids = Object.keys(data.partial);
            for(var j = 0; j < pids.length; j++){
                if(persistentPartial[pids[j]] == null) persistentPartial[pids[j]] = data.partial[pids[j]];
            }
        }
        savePersistentState(false);
        masterActivationKey = null;
        refreshGlobalBoostRanks();
        try{ activateResearchedMasters(); }catch(e){}
        try{ applyAllBulletUpgrades(); }catch(e2){}
        anyBoostActive = true;
        lastScanTick = -1000;
        Log.info("New Tech's: sync applied (" + ids.length + " levels)");
    }catch(err){ Log.err("New Tech's sync apply: " + err); }
}

function writeHostTags(){
    try{
        if(Vars.state != null && Vars.state.rules != null && Vars.state.rules.tags != null){
            Vars.state.rules.tags.put("newtechs-sync-v1", buildSyncPayload());
        }
    }catch(e){}
}

function readHostTags(){
    try{
        if(Vars.state != null && Vars.state.rules != null && Vars.state.rules.tags != null){
            var s = Vars.state.rules.tags.get("newtechs-sync-v1");
            if(s != null && (""+s).length > 2) applySyncPayload(""+s);
        }
    }catch(e){}
}

function broadcastSync(){
    try{
        writeHostTags();
        var payload = buildSyncPayload();
        if(Vars.net != null && Vars.net.server()){
            Groups.player.each(function(p){
                try{
                    if(p != null && p.con != null) Call.clientPacketReliable(p.con, NET_PACKET, payload);
                }catch(e1){}
            });
        }
    }catch(e){}
}

function requestSyncFromHost(){
    try{
        if(Vars.net != null && Vars.net.client()){
            Call.serverPacketReliable(NET_PACKET, "req");
        }
        readHostTags();
    }catch(e){}
}

function setupNetHandlers(){
    try{
        if(Vars.netServer != null && Vars.netServer.addPacketHandler != null){
            Vars.netServer.addPacketHandler(NET_PACKET, function(player, str){
                try{
                    if(str == null) return;
                    str = "" + str;
                    if(str === "req"){
                        if(player != null && player.con != null){
                            Call.clientPacketReliable(player.con, NET_PACKET, buildSyncPayload());
                        }
                    }else{
                        applySyncPayload(str);
                        broadcastSync();
                    }
                }catch(e){}
            });
            Vars.netServer.addPacketHandler("newtechs-shop", function(player, str){
                try{
                    if(player == null || str == null) return;
                    var data = null;
                    try{ data = JSON.parse(""+str); }catch(eJ){ return; }
                    if(data == null) return;
                    if(data.op === "gift"){
                        var gr = hostFulfillGift(player, data);
                        try{ if(player.con != null) Call.clientPacketReliable(player.con, "newtechs-shop", JSON.stringify(gr)); }catch(eG){}
                        return;
                    }
                    if(data.op !== "buy") return;
                    var result = hostFulfillShopBuy(player, data);
                    try{
                        if(player.con != null){
                            Call.clientPacketReliable(player.con, "newtechs-shop", JSON.stringify(result));
                        }
                    }catch(eR){}
                }catch(e){ Log.err("New Tech's shop host: " + e); }
            });
        }
    }catch(e){}
    try{
        if(Vars.netClient != null && Vars.netClient.addPacketHandler != null){
            Vars.netClient.addPacketHandler(NET_PACKET, function(str){
                try{ applySyncPayload(""+str); }catch(e){}
            });
            Vars.netClient.addPacketHandler("newtechs-shop", function(str){
                try{
                    var data = JSON.parse(""+str);
                    if(data == null) return;
                    if(data.ok){
                        try{
                            if(data.shop != null){
                                saveGlobalShop(data.shop);
                                persistentShop = data.shop;
                            }
                        }catch(eS){}
                        try{ quietInfo(tr("Purchase received!", "Compra recebida!")); }catch(eI){}
                    }else{
                        if(data.refund > 0) addPoints(data.refund|0);
                        try{ quietInfo(data.msg != null ? (""+data.msg) : tr("Purchase failed.", "Compra falhou.")); }catch(eI2){}
                    }
                }catch(e){}
            });
        }
    }catch(e2){}
}

function hostFulfillGift(fromPlayer, data){
    try{
        var target = null;
        Groups.player.each(function(p){
            if(p != null && (p.id|0) === (data.targetId|0)) target = p;
        });
        if(target == null) return {ok:false, refund:data.cost|0, msg:tr("Ally not found.", "Aliado nao encontrado.")};
        if(fromPlayer.team() !== target.team()) return {ok:false, refund:data.cost|0, msg:tr("Not same team.", "Nao e o mesmo time.")};
        var item = Vars.content.item(data.item);
        if(item == null) return {ok:false, refund:data.cost|0, msg:tr("Unknown item.", "Item desconhecido.")};
        var amt = data.amount|0;
        if(amt <= 0) amt = 1;
        if(!giveItemsToTeam(target.team(), item, amt, target)){
            return {ok:false, refund:data.cost|0, msg:tr("No core.", "Sem nucleo.")};
        }
        return {ok:true};
    }catch(e){ return {ok:false, refund:data.cost|0, msg:tr("Server error.", "Erro no servidor.")}; }
}

function hostFulfillShopBuy(player, data){
    try{
        ensurePointSystems();
        var kind = data.kind === "unit" ? "unit" : "item";
        var index = data.index|0;
        var g = loadGlobalShop();
        if(g == null) return {ok:false, refund:data.cost|0, msg:tr("Shop unavailable.", "Loja indisponivel.")};
        var slots = kind === "unit" ? g.unitSlots : g.itemSlots;
        if(slots == null || index < 0 || index >= slots.length) return {ok:false, refund:data.cost|0, msg:tr("Invalid slot.", "Slot invalido.")};
        var slot = slots[index];
        if(slot == null) return {ok:false, refund:data.cost|0, msg:tr("Empty slot.", "Slot vazio.")};
        if((slot.stock|0) <= 0) return {ok:false, refund:data.cost|0, msg:tr("Out of stock.", "Fora de estoque.")};

        if(slot.kind === "item"){
            var item = Vars.content.item(slot.name);
            if(item == null) return {ok:false, refund:data.cost|0, msg:tr("Unknown item.", "Item desconhecido.")};
            var amt = slot.amount|0;
            if(amt <= 0) amt = 1;
            if(!giveItemsToTeam(player.team(), item, amt, player)){
                return {ok:false, refund:data.cost|0, msg:tr("No core to receive items.", "Sem nucleo para receber itens.")};
            }
        }else if(slot.kind === "unit"){
            var ut = Vars.content.unit(slot.name);
            if(ut == null) return {ok:false, refund:data.cost|0, msg:tr("Unknown unit.", "Unidade desconhecida.")};
            if(!spawnUnitNearPlayer(ut, player)){
                return {ok:false, refund:data.cost|0, msg:tr("Could not spawn unit.", "Nao foi possivel criar a unidade.")};
            }
        }else{
            return {ok:false, refund:data.cost|0, msg:tr("Invalid product.", "Produto invalido.")};
        }
        slot.stock = (slot.stock|0) - 1;
        if(slot.stock < 0) slot.stock = 0;
        saveGlobalShop(g);
        persistentShop = g;
        return {ok:true, shop:g};
    }catch(e){
        Log.err("hostFulfillShopBuy: " + e);
        return {ok:false, refund:data.cost|0, msg:tr("Server error.", "Erro no servidor.")};
    }
}

function giveItemsToTeam(team, item, amount, player){
    if(team == null || item == null || amount <= 0) return false;
    try{
        var core = null;
        try{ if(player != null) core = player.core(); }catch(e0){}
        if(core == null){
            try{ core = team.core(); }catch(e1){}
        }
        if(core != null && core.items != null){
            try{ core.items.add(item, amount); return true; }catch(e2){}
            try{ core.handleStack(item, amount, player != null ? player.unit() : null); return true; }catch(e3){}
        }
        try{
            if(team.cores != null){
                for(var i = 0; i < team.cores.size; i++){
                    var c = team.cores.get(i);
                    if(c == null || c.items == null) continue;
                    try{ c.items.add(item, amount); return true; }catch(e4){}
                }
            }
        }catch(e5){}
    }catch(e){}
    return false;
}

function spawnUnitNearPlayer(unitType, player){
    try{
        if(unitType == null || player == null) return false;
        var team = player.team();
        var px = player.x, py = player.y;
        var bestX = px, bestY = py, bestScore = -1e9;
        for(var r = 0; r <= 16; r++){
            for(var dx = -r; dx <= r; dx++){
                for(var dy = -r; dy <= r; dy++){
                    if(r > 0 && Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                    var tile = Vars.world.tile((px/8+dx)|0, (py/8+dy)|0);
                    if(tile == null) continue;
                    try{ if(tile.solid()) continue; }catch(eS){}
                    try{ if(tile.floor() != null && tile.floor().isDeep()) continue; }catch(eD){}
                    var score = 50 - (Math.abs(dx)+Math.abs(dy));
                    if(score > bestScore){ bestScore = score; bestX = tile.worldx(); bestY = tile.worldy(); }
                }
            }
        }
        var unit = null;
        try{ unit = unitType.spawn(team, bestX, bestY); }catch(e1){}
        if(unit == null){
            try{
                unit = unitType.create(team);
                if(unit != null){ unit.set(bestX, bestY); unit.add(); }
            }catch(e2){}
        }
        return unit != null;
    }catch(e){ return false; }
}

// ---------- Bullet upgrades (global, no install) ----------
function isItemBulletTurret(b){
    if(b == null) return false;
    try{
        // Any block that exposes a non-empty ammoTypes map can receive extra ammo.
        if(b.ammoTypes != null && b.ammoTypes.size > 0) return true;
    }catch(e){}
    try{
        // Fallback: class hierarchy (ItemTurret and subclasses / mod wrappers)
        var cls = classNameOf(b).toLowerCase();
        if(cls.indexOf("itemturret") >= 0) return b.ammoTypes != null;
    }catch(e2){}
    try{
        return b instanceof Packages.mindustry.world.blocks.defense.turrets.ItemTurret;
    }catch(e3){}
    return false;
}

function unitHasGuns(u){
    if(u == null) return false;
    try{
        if(u.weapons == null || u.weapons.size <= 0) return false;
        return true;
    }catch(e){ return false; }
}

function bulletId(prefix, name, kind){
    return "bullet-" + safePart(prefix + "-" + name + "-" + kind);
}

function ensureBulletSnapshotTurret(block){
    var key = "t:" + block.name;
    if(bulletBaseSnapshot[key] != null) return bulletBaseSnapshot[key];
    var snap = {reload: block.reload, range: block.range, ammo: {}};
    try{
        var entries = block.ammoTypes.entries();
        while(entries.hasNext()){
            var e = entries.next();
            var item = e.key;
            var bt = e.value;
            if(item == null || bt == null) continue;
            snap.ammo[""+item.name] = {
                damage: bt.damage,
                lifetime: bt.lifetime,
                speed: bt.speed,
                pierce: bt.pierceCap != null ? bt.pierceCap : 0
            };
        }
    }catch(e){}
    bulletBaseSnapshot[key] = snap;
    return snap;
}

function ensureBulletSnapshotUnit(unitType){
    var key = "u:" + unitType.name;
    if(bulletBaseSnapshot[key] != null) return bulletBaseSnapshot[key];
    var snap = {weapons: []};
    try{
        for(var i = 0; i < unitType.weapons.size; i++){
            var w = unitType.weapons.get(i);
            if(w == null || w.bullet == null){ snap.weapons.push(null); continue; }
            snap.weapons.push({
                reload: w.reload,
                damage: w.bullet.damage,
                lifetime: w.bullet.lifetime,
                speed: w.bullet.speed
            });
        }
    }catch(e){}
    bulletBaseSnapshot[key] = snap;
    return snap;
}

function makeBulletUp(id, targetFn, kind, nameEn, namePt, descEn, descPt, costFn){
    var u = makeUp(id, targetFn, 5, costFn, nameEn, namePt, descEn, descPt, "bullet " + kind);
    u.globalResearch = true;
    u.bulletKind = kind;
    u.bulletTarget = targetFn;
    return u;
}

function addBulletGroupForTurret(block){
    var name = "" + block.name;
    var loc = block.localizedName;
    var group = {
        titleEn: loc + " (Bullets)",
        titlePt: loc + " (Tiros)",
        dynamicTitle: true,
        block: function(){ return block; },
        upgrades: [],
        category: "bullet",
        planet: planetKeyForBlock(block),
        bulletGroup: true
    };
    var kinds = [
        {k:"dmg", en:"Heavier Rounds", pt:"Projéteis Pesados",
            deEn:"+12% bullet damage / rank. Fire rate slows slightly.", dePt:"+12% dano do tiro / nível. Cadência fica um pouco mais lenta."},
        {k:"rof", en:"Faster Cycle", pt:"Ciclo Mais Rápido",
            deEn:"+8% fire rate / rank. Slight damage trade-off.", dePt:"+8% cadência / nível. Leve perda de dano."},
        {k:"range", en:"Longer Barrel", pt:"Cano Mais Longo",
            deEn:"+6% range / rank.", dePt:"+6% alcance / nível."},
        {k:"vel", en:"Hotter Propellant", pt:"Propulsão Mais Quente",
            deEn:"+7% bullet speed / rank.", dePt:"+7% velocidade do projétil / nível."}
    ];
    for(var i = 0; i < kinds.length; i++){
        (function(spec, index){
            var id = bulletId("turret", name, spec.k);
            if(UPGRADES[id] == null){
                UPGRADES[id] = makeBulletUp(id, function(){ return block; }, spec.k,
                    loc + " — " + spec.en, loc + " — " + spec.pt,
                    spec.deEn, spec.dePt,
                    function(lv){ return [[Items.copper, 80 + index * 40 + lv * 60],[Items.lead, 50 + index * 25 + lv * 40],[Items.graphite, 20 + index * 15 + lv * 25]]; });
            }
            group.upgrades.push(id);
        })(kinds[i], i);
    }
    GROUPS.push(group);
    BLOCK_GROUPS["bullet-turret-" + name] = group;
    if(CATEGORY_GROUPS["bullet"] == null) CATEGORY_GROUPS["bullet"] = [];
    CATEGORY_GROUPS["bullet"].push(group);
}

function addBulletGroupForUnit(unitType){
    var name = "" + unitType.name;
    var loc = unitType.localizedName;
    var dummyBlock = Blocks.duo; // cost reference only
    var group = {
        titleEn: loc + " (Unit Guns)",
        titlePt: loc + " (Armas da Unidade)",
        dynamicTitle: true,
        block: function(){ return dummyBlock; },
        unitType: unitType,
        upgrades: [],
        category: "bullet",
        planet: unitPlanetKey(unitType),
        bulletGroup: true,
        isUnitBullet: true
    };
    var kinds = [
        {k:"dmg", en:"Armor-Piercing Load", pt:"Carga Perfurante",
            deEn:"+15% weapon damage / rank. No reload penalty.", dePt:"+15% dano da arma / nível. Sem penalidade de recarga."},
        {k:"rof", en:"Servo Fire Rate", pt:"Cadência dos Servos",
            deEn:"+12% weapon fire rate / rank. Keeps full damage.", dePt:"+12% cadência / nível. Mantém o dano completo."},
        {k:"vel", en:"Muzzle Velocity", pt:"Velocidade de Boca",
            deEn:"+10% bullet speed / rank and tighter shots.", dePt:"+10% velocidade do projétil / nível e tiros mais firmes."}
    ];
    for(var i = 0; i < kinds.length; i++){
        (function(spec, index){
            var id = bulletId("unit", name, spec.k);
            if(UPGRADES[id] == null){
                UPGRADES[id] = makeBulletUp(id, function(){ return dummyBlock; }, "unit-" + spec.k,
                    loc + " — " + spec.en, loc + " — " + spec.pt,
                    spec.deEn, spec.dePt,
                    function(lv){ return [[Items.silicon, 40 + index * 30 + lv * 45],[Items.titanium, 30 + index * 25 + lv * 35],[Items.graphite, 40 + index * 20 + lv * 30]]; });
                UPGRADES[id].unitName = name;
            }
            group.upgrades.push(id);
        })(kinds[i], i);
    }
    GROUPS.push(group);
    if(CATEGORY_GROUPS["bullet"] == null) CATEGORY_GROUPS["bullet"] = [];
    CATEGORY_GROUPS["bullet"].push(group);
}

function ammoRoleForItem(item){
    if(item == null || item.name == null) return "standard";
    var n = ("" + item.name).toLowerCase();
    if(n === "silicon" || n === "phase-fabric") return "guided";
    if(n === "graphite" || n === "carbide") return "piercing";
    if(n === "thorium" || n === "blast-compound") return "explosive";
    if(n === "pyratite" || n === "coal") return "incendiary";
    if(n === "plastanium" || n === "titanium" || n === "beryllium") return "fast";
    if(n === "surge-alloy" || n === "tungsten") return "heavy";
    if(n === "metaglass" || n === "oxide") return "stable";
    if(n === "copper" || n === "lead") return "standard";
    return "standard";
}

function copyUsefulBullet(base, role){
    if(base == null) return null;
    var bullet = null;
    try{
        // BulletType implements copy() in Mindustry. Use it so special projectile
        // classes (ArtilleryBulletType, RailBulletType, etc.) keep their native
        // behavior instead of mutating the original ammo projectile.
        if(typeof base.copy === "function") bullet = base.copy();
    }catch(copyErr){}
    if(bullet == null){
        try{
            var cname = classNameOf(base).toLowerCase();
            if(cname.indexOf("basicbullettype") >= 0){
                var BasicBulletType = Packages.mindustry.entities.bullet.BasicBulletType;
                bullet = new BasicBulletType(base.speed, Math.max(1, base.damage));
                bullet.width = base.width;
                bullet.height = base.height;
                bullet.lifetime = base.lifetime;
                bullet.ammoMultiplier = Math.max(1, base.ammoMultiplier);
                bullet.reloadMultiplier = base.reloadMultiplier;
                bullet.knockback = base.knockback;
                bullet.homingPower = base.homingPower;
                bullet.homingRange = base.homingRange;
                bullet.pierce = base.pierce;
                bullet.pierceCap = base.pierceCap;
                bullet.pierceBuilding = base.pierceBuilding;
                bullet.collidesAir = base.collidesAir;
                bullet.collidesGround = base.collidesGround;
                bullet.collidesTiles = base.collidesTiles;
                bullet.splashDamage = base.splashDamage;
                bullet.splashDamageRadius = base.splashDamageRadius;
                bullet.status = base.status;
                bullet.statusDuration = base.statusDuration;
                bullet.rangeChange = base.rangeChange;
                bullet.velocityRnd = base.velocityRnd;
            }
        }catch(fallbackErr){}
    }
    if(bullet == null) return null;
    try{
        if(role === "guided"){
            bullet.speed = (bullet.speed || 1) * 1.12;
            bullet.homingPower = Math.max(bullet.homingPower || 0, 0.10);
            bullet.homingRange = Math.max(bullet.homingRange || 0, 60);
            bullet.damage = Math.max(1, bullet.damage * 0.98);
        }else if(role === "piercing"){
            bullet.damage = Math.max(1, bullet.damage * 1.18);
            bullet.pierce = true;
            bullet.pierceCap = Math.max(bullet.pierceCap || 0, 2);
            bullet.pierceBuilding = true;
        }else if(role === "explosive"){
            bullet.damage = Math.max(1, bullet.damage * 1.08);
            bullet.splashDamage = Math.max(bullet.splashDamage || 0, bullet.damage * 0.55);
            bullet.splashDamageRadius = Math.max(bullet.splashDamageRadius || 0, 18);
        }else if(role === "incendiary"){
            bullet.damage = Math.max(1, bullet.damage * 0.96);
            try{ bullet.status = StatusEffects.burning; bullet.statusDuration = Math.max(bullet.statusDuration || 0, 90); }catch(eBurn){}
        }else if(role === "fast"){
            bullet.speed = (bullet.speed || 1) * 1.18;
            bullet.damage = Math.max(1, bullet.damage * 0.96);
        }else if(role === "heavy"){
            bullet.damage = Math.max(1, bullet.damage * 1.28);
            bullet.speed = (bullet.speed || 1) * 0.92;
        }else if(role === "stable"){
            bullet.damage = Math.max(1, bullet.damage * 1.10);
            bullet.knockback = (bullet.knockback || 0) + 0.3;
        }
    }catch(roleErr){}
    return bullet;
}

function chooseAmmoSourceItem(block, newItem, role){
    if(block == null || block.ammoTypes == null) return null;
    var data = null;
    try{ data = NewTechAmmo.capture(block); }catch(e0){ data = null; }
    var bestItem = null, bestScore = -999999;
    try{
        var list = data != null ? data.items : null;
        if(list != null){
            for(var li = 0; li < list.length; li++){
                var pair = list[li];
                var item = pair.item;
                var bt = pair.bullet;
                if(item == null || bt == null) continue;
                var score = 0;
                var cls = classNameOf(bt).toLowerCase();
                if(role === "guided") score += (bt.homingPower || 0) > 0 ? 50 : 0;
                if(role === "piercing") score += bt.pierce ? 50 : 0;
                if(role === "explosive") score += ((bt.splashDamage || 0) > 0 ? 40 : 0) + (cls.indexOf("artillery") >= 0 ? 20 : 0) + (cls.indexOf("flak") >= 0 ? 15 : 0);
                if(role === "incendiary") score += (bt.makeFire ? 45 : 0) + (bt.status === StatusEffects.burning ? 35 : 0);
                if(role === "fast") score += Math.max(0, Math.round((bt.speed || 0) * 2));
                if(role === "heavy") score += Math.max(0, Math.round((bt.damage || 0) * 2));
                if(role === "stable") score += Math.max(0, Math.round((bt.knockback || 0) * 4));
                if(cls.indexOf("rail") >= 0) score += 25;
                if(cls.indexOf("missile") >= 0 && role === "guided") score += 20;
                if(score > bestScore){ bestScore = score; bestItem = item; }
            }
        }
    }catch(e){}
    if(bestItem != null) return bestItem;
    try{
        if(data != null && data.items.length > 0) return data.items[0].item;
    }catch(e2){}
    try{
        var keys = block.ammoTypes.keys();
        if(keys != null && keys.hasNext()) return keys.next();
    }catch(e3){}
    return null;
}

function markAmmoItemAccepted(block, item){
    if(block == null) return;
    try{
        // Prefer Java rebuild of itemFilter from the full ammoTypes map (PatchEditor-style live edit)
        var JC = javaAmmoTurretClass();
        if(JC != null && JC.rebuildItemFilter != null){
            JC.rebuildItemFilter(block);
            return;
        }
    }catch(eJ){}
    try{
        block.hasItems = true;
        block.acceptsItems = true;
        var size = Vars.content.items().size;
        if(block.itemFilter == null || block.itemFilter.length < size){
            block.itemFilter = [];
            for(var i = 0; i < size; i++) block.itemFilter[i] = false;
        }
        // Mark every item currently in ammoTypes (live map)
        if(block.ammoTypes != null){
            var it = block.ammoTypes.entries();
            while(it.hasNext()){
                var e = it.next();
                if(e.key != null && e.key.id >= 0) block.itemFilter[e.key.id] = true;
            }
        }else if(item != null && item.id >= 0){
            block.itemFilter[item.id] = true;
        }
    }catch(e){ Log.err("New Tech's ammo filter update failed: " + e); }
}

function cloneAmmoBullet(base, role){
    if(base == null) return null;
    var bullet = null;
    try{
        // BulletType.copy() performs a real clone of the original projectile,
        // preserving Artillery/Flak/Rail/Missile/etc. instead of downgrading it
        // to a generic BasicBulletType.
        bullet = base.copy();
    }catch(copyErr){
        Log.err("New Tech's bullet copy failed: " + copyErr);
        return null;
    }
    if(bullet == null) return null;
    try{
        if(role === "guided"){
            bullet.speed = Math.max(0.01, (bullet.speed || 1) * 1.10);
            bullet.homingPower = Math.max(bullet.homingPower || 0, 0.10);
            bullet.homingRange = Math.max(bullet.homingRange || 0, 60);
        }else if(role === "piercing"){
            bullet.damage = Math.max(1, (bullet.damage || 1) * 1.12);
            bullet.pierce = true;
            bullet.pierceCap = Math.max(bullet.pierceCap || 0, 2);
            bullet.pierceBuilding = true;
        }else if(role === "explosive"){
            bullet.damage = Math.max(1, (bullet.damage || 1) * 1.06);
            bullet.splashDamage = Math.max(bullet.splashDamage || 0, bullet.damage * 0.45);
            bullet.splashDamageRadius = Math.max(bullet.splashDamageRadius || 0, 16);
        }else if(role === "incendiary"){
            bullet.status = StatusEffects.burning;
            bullet.statusDuration = Math.max(bullet.statusDuration || 0, 90);
            bullet.makeFire = true;
        }else if(role === "fast"){
            bullet.speed = Math.max(0.01, (bullet.speed || 1) * 1.15);
        }else if(role === "heavy"){
            bullet.damage = Math.max(1, (bullet.damage || 1) * 1.22);
            bullet.speed = Math.max(0.01, (bullet.speed || 1) * 0.94);
        }else if(role === "stable"){
            bullet.damage = Math.max(1, (bullet.damage || 1) * 1.08);
            bullet.knockback = (bullet.knockback || 0) + 0.25;
        }
    }catch(roleErr){ Log.err("New Tech's ammo role failed: " + roleErr); }
    return bullet;
}

function addUsefulAmmoGlobal(block, item, sourceItem, role){
    if(block == null || item == null || block.ammoTypes == null) return false;
    try{
        try{
            var JC = javaAmmoTurretClass();
            if(JC != null && isItemBulletTurret(block)){
                JC.register(block, item, sourceItem, role || ammoRoleForItem(item));
                var javaOk = JC.unlock(block, item, sourceItem, role || ammoRoleForItem(item));
                if(javaOk) return true;
            }
        }catch(javaAmmoErr){ Log.err("New Tech's Java global ammo install failed on " + (block.name || "?") + ": " + javaAmmoErr); }
        if(block.ammoTypes.get(item) != null){
            markAmmoItemAccepted(block, item);
            return true;
        }
        var source = sourceItem != null ? sourceItem : chooseAmmoSourceItem(block, item, role || ammoRoleForItem(item));
        var base = source != null ? NewTechAmmo.originalBullet(block, source) : null;
        if(base == null) return false;
        var bullet = cloneAmmoBullet(base, role || ammoRoleForItem(item));
        if(bullet == null) return false;
        block.ammoTypes.put(item, bullet);
        markAmmoItemAccepted(block, item);
        var installed = block.ammoTypes.get(item);
        if(installed == null) return false;
        Log.info("New Tech's ammo installed: " + item.name + " -> " + classNameOf(installed) + " on " + block.name + " (source=" + (source != null ? source.name : "?") + ")");
        return true;
    }catch(e){
        Log.err("New Tech's ammo install failed for " + item + " on " + block + ": " + e);
        return false;
    }
}

function ammoUpgradeId(blockName, index){
    return "ammo-" + safePart(blockName) + "-" + (index + 1);
}

function ammoCandidateItems(block){
    // Prefer items not already in the turret ammo map. Mix Serpulo + Erekir pools.
    var candidates = [];
    try{
        candidates = [
            Items.silicon, Items.graphite, Items.thorium, Items.titanium, Items.metaglass,
            Items.pyratite, Items.plastanium, Items.blastCompound, Items.surgeAlloy,
            Items.copper, Items.lead, Items.coal
        ];
    }catch(e){}
    // Erekir items when present in content
    try{ if(Items.beryllium != null) candidates.push(Items.beryllium); }catch(e1){}
    try{ if(Items.tungsten != null) candidates.push(Items.tungsten); }catch(e2){}
    try{ if(Items.oxide != null) candidates.push(Items.oxide); }catch(e3){}
    try{ if(Items.carbide != null) candidates.push(Items.carbide); }catch(e4){}
    try{ if(Items.phaseFabric != null) candidates.push(Items.phaseFabric); }catch(e5){}
    var out = [];
    if(block == null || block.ammoTypes == null) return out;
    for(var i = 0; i < candidates.length && out.length < 8; i++){
        var item = candidates[i];
        try{
            if(item != null && block.ammoTypes.get(item) == null) out.push(item);
        }catch(e){}
    }
    return out;
}

var AMMO_GROUPS = {};
function refreshResearchEffectsNow(needBulletRefresh){
    try{
        ensureCatalogBuilt();
        refreshGlobalBoostRanks();
        masterActivationKey = null;
        activateResearchedMasters();
        // Ammo research has its own lightweight refresh path in setLevel().
        // A full bullet pass is now restricted to actual bullet/ammo research.
        if(needBulletRefresh){
            try{ applyAllBulletUpgrades(); }catch(eBullet){}
        }
        // Do not force a Groups.build full-map rescan from a UI click. Newly
        // installed local upgrades are inserted directly by setApplied(); global
        // targets are refreshed by the normal throttled update loop when needed.
        anyBoostActive = hasAnyLocalInstalled();
        var gk = Object.keys(globalBoostRanks);
        for(var gi = 0; gi < gk.length; gi++){
            if((globalBoostRanks[gk[gi]] || 0) > 0){ anyBoostActive = true; break; }
        }
        lastBoostTick = -1000;
    }catch(e){ Log.err("New Tech's refresh effects failed: " + e); }
}

function buildBulletCatalog(){
    if(CATEGORY_GROUPS["bullet"] == null) CATEGORY_GROUPS["bullet"] = [];
    // avoid duplicates on rebuild
    var existing = {};
    for(var i = 0; i < CATEGORY_GROUPS["bullet"].length; i++){
        var g = CATEGORY_GROUPS["bullet"][i];
        if(g != null && g.block != null){
            try{ existing["t:"+g.block().name] = true; }catch(e){}
        }
        if(g != null && g.unitType != null) existing["u:"+g.unitType.name] = true;
    }
    Vars.content.blocks().each(function(b){
        try{
            if(b == null || !b.logicVisible()) return;
            if(!isItemBulletTurret(b)) return;
            // skip pure beam/laser/power turrets without item ammo
            if(b.ammoTypes == null || b.ammoTypes.size <= 0) return;
            if(existing["t:"+b.name]) return;
            addBulletGroupForTurret(b);
            existing["t:"+b.name] = true;
        }catch(e){}
    });
    try{
        Vars.content.units().each(function(u){
            try{
                if(u == null || !unitHasGuns(u)) return;
                if(existing["u:"+u.name]) return;
                // skip pure naval/payload oddities without damage weapons
                addBulletGroupForUnit(u);
                existing["u:"+u.name] = true;
            }catch(e2){}
        });
    }catch(e3){}
    bulletCatalogBuilt = true;
}

function applyBulletTurretLevels(block){
    if(block == null) return;
    var snap = ensureBulletSnapshotTurret(block);
    var dmg = levelOf(bulletId("turret", block.name, "dmg"));
    var rof = levelOf(bulletId("turret", block.name, "rof"));
    var rng = levelOf(bulletId("turret", block.name, "range"));
    var vel = levelOf(bulletId("turret", block.name, "vel"));
    // damage up slows fire a little; rof up speeds fire and trims damage a little
    var reloadMul = (1 + 0.06 * dmg) / (1 + 0.08 * rof);
    if(reloadMul < 0.55) reloadMul = 0.55;
    if(reloadMul > 1.8) reloadMul = 1.8;
    try{ block.reload = snap.reload * reloadMul; }catch(e){}
    try{ block.range = snap.range * (1 + 0.06 * rng); }catch(e){}
    try{
        var entries = block.ammoTypes.entries();
        while(entries.hasNext()){
            var e = entries.next();
            var item = e.key;
            var bt = e.value;
            if(item == null || bt == null) continue;
            var base = snap.ammo[""+item.name];
            if(base == null) continue;
            var dmgMul = (1 + 0.12 * dmg) / (1 + 0.04 * rof);
            bt.damage = base.damage * dmgMul;
            if(base.speed != null) bt.speed = base.speed * (1 + 0.07 * vel);
            if(base.lifetime != null && rng > 0) bt.lifetime = base.lifetime * (1 + 0.03 * rng);
        }
    }catch(e2){}
}

function applyBulletUnitLevels(unitType){
    if(unitType == null) return;
    var snap = ensureBulletSnapshotUnit(unitType);
    var dmg = levelOf(bulletId("unit", unitType.name, "dmg"));
    var rof = levelOf(bulletId("unit", unitType.name, "rof"));
    var vel = levelOf(bulletId("unit", unitType.name, "vel"));
    try{
        for(var i = 0; i < unitType.weapons.size; i++){
            var w = unitType.weapons.get(i);
            var s = snap.weapons[i];
            if(w == null || s == null || w.bullet == null) continue;
            var reloadMul = (1 + 0.15 * dmg) / (1 + 0.12 * rof);
            if(reloadMul < 0.42) reloadMul = 0.42;
            if(reloadMul > 1.6) reloadMul = 1.6;
            w.reload = s.reload * reloadMul;
            var dmgMul = 1 + 0.15 * dmg + 0.02 * rof;
            w.bullet.damage = s.damage * dmgMul;
            if(s.speed != null) w.bullet.speed = s.speed * (1 + 0.10 * vel);
        }
    }catch(e){}
}

function applyAllBulletUpgrades(){
    // PvP: unit/turret bullet stats are global content — do not apply team research globally.
    if(isPvp()) return;
    try{
        Vars.content.blocks().each(function(b){
            try{
                if(isItemBulletTurret(b) && b.ammoTypes != null && b.ammoTypes.size > 0) applyBulletTurretLevels(b);
            }catch(e){}
        });
    }catch(e1){}
    try{
        Vars.content.units().each(function(u){
            try{ if(unitHasGuns(u)) applyBulletUnitLevels(u); }catch(e){}
        });
    }catch(e2){}
}

function restoreProgressEffects(){
    try{
        // Reload saved research, re-apply masters, refresh global ranks and boost cache
        activeStoreKey = null;
        activeTagKey = null;
        loadPersistentState();
        masterActivationKey = null;
        ensureCatalogBuilt();
        refreshGlobalBoostRanks();
        try{ activateResearchedMasters(); }catch(e1){}
        masterActivationKey = stateStoreKey();
        anyBoostActive = true;
        lastScanTick = -1000;
        lastBoostTick = -1000;
        try{ rescanBoostTargets(); }catch(e2){}
        try{ applyAllBulletUpgrades(); }catch(eB){}
        try{ readHostTags(); }catch(eT){}
        var n = 0;
        try{ n = Object.keys(persistentLevels).length; }catch(e3){}
        Vars.ui.showInfo(tr("Restored " + n + " research entries. Effects re-applied.", "Restaurados " + n + " progressos. Efeitos reaplicados."));
        Log.info("New Tech's: restoreProgressEffects done, levels=" + n);
    }catch(err){
        Log.err("New Tech's restore: " + err);
        Vars.ui.showInfo(tr("Restore failed. Check logs.", "Falha ao restaurar. Veja os logs."));
    }
}

function resetAllProgress(){
    try{
        ensurePersistentState();
        persistentLevels = {};
        persistentPartial = {};
        appliedMap = {};
        cachedBoostTargets = [];
        cachedBoostTargetKeys = {};
        masterActivationKey = null;
        masterAppliedTeamId = -1;
        // Restore master base stats then clear effects by reactivating empty set
        try{
            var keys = Object.keys(BLOCK_GROUPS);
            for(var r = 0; r < keys.length; r++){
                var oldGroup = BLOCK_GROUPS[keys[r]];
                if(oldGroup != null && oldGroup.block != null){
                    try{ restoreMasterBase(oldGroup.block()); }catch(eR){}
                }
            }
        }catch(eB){}
        savePersistentState(true);
        refreshGlobalBoostRanks();
        anyBoostActive = false;
        lastScanTick = -1000;
        Vars.ui.showInfo(tr("All New Tech's progress was reset.", "Todo o progresso do New Tech's foi resetado."));
        Log.info("New Tech's: progress reset");
    }catch(err){
        Log.err("New Tech's reset: " + err);
        Vars.ui.showInfo(tr("Reset failed. Check logs.", "Falha ao resetar. Veja os logs."));
    }
}


// ========== Map Contracts (timed master-style missions) ==========
function contractsMapKey(){
    try{ return safePart(mapIdentity() + "-" + currentGameModeKey()); }catch(e){ return "default"; }
}
function nowMs(){
    // Always a JS number — Java Long from Time.millis() breaks comparisons in Rhino
    try{
        var t = Time.millis();
        var n = Number(t);
        if(isFinite(n) && n > 0) return n;
    }catch(e){}
    try{ return Date.now(); }catch(e2){}
    return 0;
}
function contractDurationSecs(c){
    var s = 0;
    try{ s = Number(c.secs); }catch(e){ s = 0; }
    if(!isFinite(s) || s < 60) s = 600;
    return s|0;
}
function formatContractTime(leftSec){
    leftSec = Math.max(0, leftSec|0);
    var mm = (leftSec / 60)|0;
    var ss = leftSec % 60;
    return mm + ":" + (ss < 10 ? "0" : "") + ss;
}
function loadContracts(){
    try{
        var k = CONTRACT_KEY + "-" + contractsMapKey();
        var s = Core.settings.getString(k, "");
        if(s && s.length > 2){
            activeContracts = JSON.parse(s);
            return;
        }
    }catch(e){}
    activeContracts = null;
}
function saveContracts(){
    try{
        var k = CONTRACT_KEY + "-" + contractsMapKey();
        Core.settings.put(k, JSON.stringify(activeContracts));
    }catch(e){}
}
function rollMapContracts(){
    var mode = currentGameModeKey();
    var list = [];
    var templates = [
        {type:"core_items", target:2000, secs:600, rarity:"rare", en:"Deposit 2000 items in 10 min", pt:"Deposite 2000 itens em 10 min"},
        {type:"core_items", target:5000, secs:900, rarity:"epic", en:"Deposit 5000 items in 15 min", pt:"Deposite 5000 itens em 15 min"},
        {type:"build_any", target:50, secs:480, rarity:"uncommon", en:"Build 50 blocks in 8 min", pt:"Construa 50 blocos em 8 min"},
        {type:"build_any", target:120, secs:720, rarity:"rare", en:"Build 120 blocks in 12 min", pt:"Construa 120 blocos em 12 min"},
        {type:"units_built", target:8, secs:600, rarity:"rare", en:"Produce 8 units in 10 min", pt:"Produza 8 unidades em 10 min"}
    ];
    if(mode === "pvp" || mode === "attack"){
        templates.push({type:"destroy_enemy", target:25, secs:600, rarity:"epic", en:"Destroy 25 enemy buildings in 10 min", pt:"Destrua 25 predios inimigos em 10 min"});
    }
    if(mode === "survival" || mode === "campaign"){
        templates.push({type:"wave", target:5, secs:900, rarity:"rare", en:"Survive 5 waves within 15 min", pt:"Sobreviva a 5 waves em 15 min"});
    }
    var used = {};
    var tries = 0;
    while(list.length < 3 && tries < 40){
        tries++;
        var t = templates[(Math.random()*templates.length)|0];
        var key = t.type + "-" + t.target;
        if(used[key]) continue;
        used[key] = true;
        var reward = rarityPointsReward(t.rarity);
        reward = Math.min(2000, reward + 200);
        list.push({
            id: "ct-" + nowMs() + "-" + list.length,
            type: t.type,
            target: t.target,
            progress: 0,
            secs: t.secs,
            deadline: 0,
            rarity: t.rarity,
            reward: reward,
            en: t.en,
            pt: t.pt,
            claimed: false,
            failed: false,
            accepted: false
        });
    }
    activeContracts = { list: list, mapKey: contractsMapKey(), rolledAt: nowMs() };
    saveContracts();
}
function ensureContracts(){
    loadContracts();
    if(activeContracts == null || activeContracts.list == null || activeContracts.mapKey !== contractsMapKey()){
        rollMapContracts();
    }
    try{
        var now = nowMs();
        var list = activeContracts.list;
        var changed = false;
        for(var i = 0; i < list.length; i++){
            var c = list[i];
            if(c == null) continue;
            // Strict: only boolean true counts as accepted (fixes auto-accept / old saves)
            if(c.accepted !== true){
                if(c.accepted || (c.deadline|0) > 0 || (c.progress|0) > 0){
                    changed = true;
                }
                c.accepted = false;
                c.deadline = 0;
                c.progress = 0;
                if(!c.claimed) c.failed = false;
                continue;
            }
            if(c.claimed || c.failed) continue;
            var dl = Number(c.deadline);
            if(!isFinite(dl) || dl <= 0){
                // Accepted but missing deadline — do not auto-start; require re-accept
                c.accepted = false;
                c.deadline = 0;
                c.progress = 0;
                changed = true;
                continue;
            }
            if(now > dl && (c.progress|0) < (c.target|0)){
                c.failed = true;
                changed = true;
            }
        }
        if(changed) saveContracts();
    }catch(e){}
}
function bumpContract(type, amount){
    try{
        ensureContracts();
        if(activeContracts == null || activeContracts.list == null) return;
        amount = amount || 1;
        var now = nowMs();
        var changed = false;
        for(var i = 0; i < activeContracts.list.length; i++){
            var c = activeContracts.list[i];
            if(c == null || c.claimed || c.failed || c.accepted !== true) continue;
            if(c.type !== type) continue;
            var dl = Number(c.deadline);
            if(isFinite(dl) && dl > 0 && now > dl){
                c.failed = true;
                changed = true;
                continue;
            }
            c.progress = (c.progress|0) + amount;
            if(c.progress > c.target) c.progress = c.target;
            changed = true;
        }
        if(changed) saveContracts();
    }catch(e){}
}

function acceptContract(id){
    // Only called from the Accept button — never auto
    loadContracts();
    if(activeContracts == null || activeContracts.list == null) return false;
    if(activeContracts.mapKey !== contractsMapKey()) return false;
    for(var i = 0; i < activeContracts.list.length; i++){
        var c = activeContracts.list[i];
        if(c == null || c.id !== id) continue;
        if(c.claimed) return false;
        if(c.accepted === true && !c.failed) return false;
        var dur = contractDurationSecs(c);
        c.secs = dur;
        c.accepted = true;
        c.failed = false;
        c.claimed = false;
        c.progress = 0;
        c.deadline = nowMs() + dur * 1000;
        c.acceptedAt = nowMs();
        saveContracts();
        return true;
    }
    return false;
}
function claimContract(id){
    ensureContracts();
    if(activeContracts == null) return false;
    for(var i = 0; i < activeContracts.list.length; i++){
        var c = activeContracts.list[i];
        if(c == null || c.id !== id) continue;
        if(c.claimed || !c.accepted) return false;
        var now = nowMs();
        var dl = Number(c.deadline);
        if(isFinite(dl) && dl > 0 && now > dl && (c.progress|0) < (c.target|0)){
            c.failed = true;
            saveContracts();
            return false;
        }
        if(c.failed) return false;
        if((c.progress|0) < (c.target|0)) return false;
        c.claimed = true;
        addPoints(c.reward|0);
        try{
            var item = null;
            try{ item = Vars.content.item("surge-alloy"); }catch(e1){}
            if(item == null) try{ item = Vars.content.item("thorium"); }catch(e2){}
            if(item == null) try{ item = Vars.content.item("titanium"); }catch(e3){}
            if(item != null) giveItemsToPlayerTeam(item, c.rarity === "epic" ? 20 : 10);
        }catch(eI){}
        saveContracts();
        return true;
    }
    return false;
}
function showContractsDialog(){
    ensureContracts();
    var dialog = new BaseDialog(tr("Map Contracts", "Contratos do Mapa"));
    var body = new Table();
    body.defaults().growX().pad(4);
    body.add("[accent]" + tr("Accept a contract to start the timer.", "Aceite um contrato para comecar o tempo.")).wrap().row();
    body.add("[gray]" + tr("Rewards: points + rare items to your core.", "Recompensas: pontos + itens raros no nucleo.")).wrap().padBottom(6).row();
    var list = (activeContracts && activeContracts.list) ? activeContracts.list : [];
    var now = nowMs();
    for(var i = 0; i < list.length; i++){
        (function(c){
            body.table(Tex.button, function(tbl){
                tbl.left().defaults().left().pad(4);
                var title = tr(c.en, c.pt);
                var dl = Number(c.deadline);
                var leftSec = 0;
                if(c.accepted === true && isFinite(dl) && dl > 0){
                    leftSec = Math.max(0, Math.floor((dl - now) / 1000));
                }else{
                    leftSec = contractDurationSecs(c);
                }
                if(c.accepted === true && !c.claimed && !c.failed && isFinite(dl) && dl > 0 && now > dl && (c.progress|0) < (c.target|0)){
                    c.failed = true;
                    try{ saveContracts(); }catch(eF){}
                }
                var isAcc = (c.accepted === true);
                var status;
                if(c.claimed) status = "[lime]" + tr("CLAIMED", "COLETADO");
                else if(c.failed && isAcc) status = "[scarlet]" + tr("FAILED", "FALHOU");
                else if(!isAcc) status = "[gray]" + tr("AVAILABLE", "DISPONIVEL");
                else if((c.progress|0) >= (c.target|0)) status = "[lime]" + tr("READY", "PRONTO");
                else status = "[accent]" + tr("ACTIVE", "ATIVO");
                tbl.add(status).row();
                tbl.add("[white]" + title).wrap().growX().row();
                tbl.add("[#ffd54f]" + (c.reward|0) + " pts + items").row();
                if(!isAcc && !c.claimed){
                    tbl.add("[lightgray]" + tr("Duration: ", "Duracao: ") + formatContractTime(contractDurationSecs(c))).row();
                    tbl.add("[gray]" + tr("Timer starts only after you accept.", "O tempo so comeca depois que voce aceitar.")).wrap().row();
                }else if(isAcc && !c.claimed && !c.failed){
                    tbl.add("[accent]" + tr("Time left: ", "Tempo restante: ") + formatContractTime(leftSec)).row();
                    tbl.add("[lightgray]" + tr("Progress: ", "Progresso: ") + (c.progress|0) + "/" + (c.target|0)).row();
                }else if(c.failed && isAcc){
                    tbl.add("[scarlet]" + tr("Time ran out.", "O tempo acabou.")).row();
                }
                if(!isAcc && !c.claimed){
                    tbl.button(tr("Accept", "Aceitar"), function(){
                        var cid = c.id;
                        if(acceptContract(cid)){
                            quietInfo(tr("Contract accepted! Timer started.", "Contrato aceito! Tempo comecou."));
                        }
                        dialog.hide();
                        showContractsDialog();
                    }).size(140, 40).padTop(4);
                }else if(!c.claimed && !c.failed && isAcc && (c.progress|0) >= (c.target|0)){
                    tbl.button(tr("Claim", "Coletar"), function(){
                        if(claimContract(c.id)){
                            quietInfo(tr("Contract claimed!", "Contrato coletado!"));
                        }
                        dialog.hide();
                        showContractsDialog();
                    }).size(140, 40).padTop(4);
                }
            }).growX().pad(3).row();
        })(list[i]);
    }
    body.button(tr("Reroll contracts (costs 400 pts)", "Trocar contratos (400 pts)"), function(){
        if(!spendPoints(400)){
            quietInfo(tr("Not enough points.", "Pontos insuficientes."));
            return;
        }
        rollMapContracts();
        dialog.hide();
        showContractsDialog();
    }).size(280, 42).padTop(8).row();
    dialog.addCloseButton();
    dialog.cont.pane(body).grow().pad(8);
    dialog.show();
}

// ========== Specialization tree (one path) ==========
function loadSpecialization(){
    try{ specializationPath = Core.settings.getString(SPEC_KEY, ""); if(specializationPath === "") specializationPath = null; }catch(e){ specializationPath = null; }
}
function saveSpecialization(){
    try{ Core.settings.put(SPEC_KEY, specializationPath == null ? "" : specializationPath); }catch(e){}
}
function specMultiplierForCategory(cat){
    try{
        loadSpecialization();
        if(specializationPath == null || specializationPath === "") return 1;
        if(cat === specializationPath) return 1.12; // +12% on chosen path
        // light penalty on other research categories (not bullet/special)
        if(cat === "bullet" || cat === "logic") return 1;
        return 0.96; // -4%
    }catch(e){ return 1; }
}
function showSpecializationDialog(){
    loadSpecialization();
    var dialog = new BaseDialog(tr("Specialization", "Especializacao"));
    var body = new Table();
    body.defaults().growX().pad(4);
    body.add("[accent]" + tr("Pick ONE path. Stronger bonuses there, slight penalty elsewhere.", "Escolha UM caminho. Bonus nele, leve penalidade nos outros.")).wrap().row();
    body.add("[gray]" + tr("Current: ", "Atual: ") + (specializationPath == null ? tr("None", "Nenhum") : catLabel(specializationPath))).padBottom(6).row();
    var paths = ["production", "crafting", "turret", "defense", "power", "unit"];
    for(var i = 0; i < paths.length; i++){
        (function(cat){
            var selected = specializationPath === cat;
            body.button((selected ? "[lime]✓ " : "") + catLabel(cat) + "  [gray]+12%", function(){
                specializationPath = cat;
                saveSpecialization();
                Vars.ui.showInfo(tr("Specialization: ", "Especializacao: ") + catLabel(cat));
                dialog.hide();
                showSpecializationDialog();
            }).growX().height(44).pad(3).row();
        })(paths[i]);
    }
    body.button(tr("Clear specialization", "Limpar especializacao"), function(){
        specializationPath = null;
        saveSpecialization();
        dialog.hide();
        showSpecializationDialog();
    }).size(240, 40).padTop(8).row();
    dialog.addCloseButton();
    dialog.cont.pane(body).grow().pad(8);
    dialog.show();
}

// ========== Ally gift (points → items to teammate core) ==========
function showAllyGiftDialog(){
    var dialog = new BaseDialog(tr("Send to Ally", "Enviar ao Aliado"));
    var body = new Table();
    body.defaults().growX().pad(4);
    body.add("[accent]" + tr("Spend points to send resources to a teammate's core.", "Gaste pontos para mandar recursos ao nucleo de um aliado.")).wrap().row();
    body.add("[#ffd54f]" + tr("Your points: ", "Seus pontos: ") + (persistentPoints|0)).padBottom(6).row();

    var allies = [];
    try{
        var myTeam = Vars.player != null ? Vars.player.team() : null;
        Groups.player.each(function(p){
            if(p == null || p === Vars.player) return;
            if(myTeam != null && p.team() === myTeam) allies.push(p);
        });
    }catch(e){}

    if(allies.length === 0){
        body.add("[gray]" + tr("No teammates online. (Works in multiplayer co-op.)", "Nenhum aliado online. (Funciona em co-op multiplayer.)")).wrap().row();
    }

    var giftItems = [];
    try{
        var names = ["copper", "lead", "silicon", "titanium", "thorium", "plastanium", "phase-fabric", "surge-alloy"];
        for(var gi = 0; gi < names.length; gi++){
            var it = Vars.content.item(names[gi]);
            if(it != null) giftItems.push(it);
        }
    }catch(e2){}

    function giftCost(item, amount){
        var base = 2;
        try{
            var n = (""+item.name).toLowerCase();
            if(n.indexOf("surge") >= 0 || n.indexOf("phase") >= 0) base = 8;
            else if(n.indexOf("thorium") >= 0 || n.indexOf("plastanium") >= 0) base = 5;
            else if(n.indexOf("titanium") >= 0 || n.indexOf("silicon") >= 0) base = 3;
        }catch(e){}
        return Math.max(20, amount * base);
    }

    for(var a = 0; a < allies.length; a++){
        (function(player){
            body.add("[white]" + (player.name() != null ? player.name() : "Player")).padTop(6).row();
            body.table(Styles.none, function(row){
                for(var ii = 0; ii < Math.min(4, giftItems.length); ii++){
                    (function(item){
                        var amount = 50;
                        var cost = giftCost(item, amount);
                        row.button(item.localizedName + "\n" + amount + "\n" + cost + "pts", function(){
                            if(!spendPoints(cost)){
                                quietInfo(tr("Not enough points.", "Pontos insuficientes."));
                                return;
                            }
                            var ok = false;
                            try{
                                if(shopUsesHostRelay()){
                                    Call.serverPacketReliable("newtechs-shop", JSON.stringify({
                                        op: "gift",
                                        targetId: player.id,
                                        item: ""+item.name,
                                        amount: amount,
                                        cost: cost
                                    }));
                                    ok = true;
                                }else{
                                    ok = giveItemsToTeam(player.team(), item, amount, player);
                                }
                            }catch(eG){}
                            if(ok){
                                quietInfo(tr("Gift sent!", "Presente enviado!"));
                            }else{
                                addPoints(cost);
                                quietInfo(tr("Gift failed.", "Falha ao enviar."));
                            }
                        }).size(90, 70).pad(2);
                    })(giftItems[ii]);
                }
            }).row();
        })(allies[a]);
    }

    dialog.addCloseButton();
    dialog.cont.pane(body).grow().pad(8);
    dialog.show();
}


function showResearchDialog(){
    ensureCatalogBuilt();
    var dialog = new BaseDialog(tr("NEW TECH'S // RESEARCH", "NEW TECH'S // PESQUISA"));
    var body = new Table();
    body.defaults().pad(6).growX();

    body.table(Styles.none, function(head){
        head.add("[#ffd54f]" + tr("New Tech's", "New Tech's")).growX();
        head.button(tr("History", "Historico"), Icon.list, function(){
            showHistoryDialog();
        }).size(Vars.mobile ? 125 : 125, 36).padRight(3);
        head.button(tr("Restore", "Restaurar"), Icon.refresh, function(){
            restoreProgressEffects();
        }).size(Vars.mobile ? 125 : 125, 36).padRight(3);
        head.button("EN", function(){ Core.settings.put(LANG_KEY,"en"); dialog.hide(); showResearchDialog(); }).size(40, 34);
        head.button("PT", function(){ Core.settings.put(LANG_KEY,"pt"); dialog.hide(); showResearchDialog(); }).size(40, 34);
        head.button("ES", function(){ Core.settings.put(LANG_KEY,"es"); dialog.hide(); showResearchDialog(); }).size(40, 34);
        head.button("VI", function(){ Core.settings.put(LANG_KEY,"vi"); dialog.hide(); showResearchDialog(); }).size(40, 34);
    }).growX().row();
    body.add("[lightgray]" + tr("Planet: ", "Planeta: ") + (currentPlanetName() || tr("Custom", "Custom")) + "  •  " + tr("Research, install, shop & missions", "Pesquise, instale, loja e missoes")).wrap().padBottom(6).row();

    var grid = new Table();
    for(var i = 0; i < CATEGORY_ORDER.length; i++){
        (function(category, index){
            var columns = Vars.mobile ? 2 : 3;
            if(index > 0 && index % columns === 0) grid.row();
            var count = categoryBlockCount(category);
            var st = CATEGORY_STYLE[category] || {col:"[accent]", tipEn:"", tipPt:""};
            var label = catLabel(category);
            grid.table(Tex.button, function(card){
                card.center().defaults().center().pad(2);
                try{ card.image(categoryIcon(category)).size(Vars.mobile ? 26 : 30).padTop(6); }catch(eIc){}
                card.row();
                card.add(st.col + label).padTop(2);
                card.row();
                card.add("[gray]" + count + " " + tr("blocks", "blocos")).padBottom(2);
                card.row();
                card.button(tr("Open", "Abrir"), function(){
                    dialog.hide();
                    showCategoryDialog(category);
                }).size(Vars.mobile ? 110 : 130, 32).padBottom(6);
            }).size(Vars.mobile ? 150 : 200, Vars.mobile ? 128 : 136).pad(6);
        })(CATEGORY_ORDER[i], i);
    }
    body.add(grid).grow().row();

    // Bullet upgrades — separate from normal block categories
    body.add("[#ffd54f]━━ " + tr("SPECIAL", "ESPECIAL") + " ━━").padTop(14).padBottom(4).row();
    body.add("[lightgray]" + tr("Exclusive tools for every player", "Ferramentas exclusivas para todos")).padBottom(6).row();
    body.table(Styles.none, function(row){
        row.button(tr("Contracts", "Contratos"), function(){ dialog.hide(); showContractsDialog(); }).size(120, 40).pad(3);
        row.button(tr("Specialize", "Especializar"), function(){ dialog.hide(); showSpecializationDialog(); }).size(130, 40).pad(3);
        row.button(tr("Gift Ally", "Presentear"), function(){ dialog.hide(); showAllyGiftDialog(); }).size(120, 40).pad(3);
    }).padBottom(6).row();
    body.table(Tex.button, function(card){
        card.center().defaults().center().pad(4);
        try{ card.image(Icon.modeAttack).size(28).padTop(4); }catch(e){}
        card.row();
        card.add("[#ff8a65]" + catLabel(BULLET_CATEGORY)).pad(2);
        card.row();
        card.add("[gray]" + tr("Turret & unit projectile tuning — global, no install", "Ajuste global de projéteis de torretas e unidades — sem instalar", "Ajuste global de proyectiles de torretas y unidades — sin instalar", "Tinh chỉnh đạn cho tháp & unit — toàn cục, không lắp")).wrap().width(Vars.mobile ? 260 : 360).pad(2);
        card.row();
        card.button(tr("Open Bullet Upgrades", "Abrir Upgrade de Tiro", "Abrir Mejora de Bala", "Mở nâng cấp đạn"), function(){
            dialog.hide();
            showCategoryDialog(BULLET_CATEGORY);
        }).size(Vars.mobile ? 200 : 220, 40).padBottom(6);
    }).growX().pad(6).row();

    // Points / dual shops / missions
    ensurePointSystems();
    body.table(Tex.button, function(card){
        card.center().defaults().center().pad(4);
        try{ card.image(Icon.book).size(28).padTop(4); }catch(e){}
        card.row();
        card.add("[#ffd54f]" + tr("POINTS & SHOPS", "PONTOS E LOJAS")).pad(2);
        card.row();
        card.add("[accent]" + tr("Points: ", "Pontos: ") + (persistentPoints|0)).pad(2);
        card.row();
        card.add("[gray]" + tr("Earn points in missions. Spend on items & units. Works online.", "Ganhe pontos nas missoes. Gaste em itens e unidades. Funciona online.")).wrap().width(Vars.mobile ? 260 : 360).pad(2);
        card.row();
        card.table(Styles.none, function(row){
            row.button(tr("Items", "Itens"), function(){ dialog.hide(); showPointShopDialog("item"); }).size(90, 40).pad(3);
            row.button(tr("Units", "Unidades"), function(){ dialog.hide(); showPointShopDialog("unit"); }).size(100, 40).pad(3);
            row.button(tr("Missions", "Missões"), function(){ dialog.hide(); showPointMissionsDialog(); }).size(100, 40).pad(3);
        }).padBottom(6);
    }).growX().pad(6).row();

    dialog.addCloseButton();
    dialog.cont.pane(body).grow().pad(8);
    dialog.show();
}

var pauseTechTable = null;
var pauseBtnInjected = false;

function injectCategoryMainButton(){
    try{
        var dialog = Vars.ui != null ? Vars.ui.paused : null;
        if(dialog == null || dialog.cont == null) return;
        var cont = dialog.cont;
        if(cont.find("newtechs-menu-btn") != null){ pauseBtnInjected = true; return; }

        var cell;
        if(Vars.mobile){
            cell = cont.buttonRow(tr("New Tech's", "New Tech's"), Icon.book, function(){
                showResearchDialog();
            }).name("newtechs-menu-btn").size(130, 55).pad(5);
        }else{
            cell = cont.button(tr("New Tech's", "New Tech's"), Icon.book, function(){
                showResearchDialog();
            }).name("newtechs-menu-btn").size(220, 55).pad(5).colspan(2);
            cont.row();
        }
        pauseBtnInjected = true;
        Log.info("New Tech's: pause button placed below Save & Quit");
    }catch(e){ Log.err("New Tech's inject: " + e); }
}

var BOOST_TICK_INTERVAL = 360;      // ~6s between boost pulses (FPS)
var BOOST_DURATION = 420;           // longer than interval so effect never drops
var SCAN_TICK_INTERVAL = 720;       // rebuild target list ~12s (FPS)
var lastBoostTick = -1000;
var lastScanTick = -1000;
var globalBoostRanks = {};
var factoryRecipeState = {};
var globalFactorByBlock = {};       // blockName -> precomputed global factor add
var cachedBoostTargets = [];        // Building[] needing boost
var cachedBoostTargetKeys = {};     // bkey -> true, keeps direct installs O(1)
var anyBoostActive = false;

function refreshGlobalBoostRanks(){
    globalBoostRanks = {};
    globalFactorByBlock = {};
    var keys = Object.keys(GLOBAL_TRANSPORT_GROUPS);
    for(var i = 0; i < keys.length; i++){
        var key = keys[i];
        var group = GLOBAL_TRANSPORT_GROUPS[key];
        if(group == null || group.upgrades == null) continue;
        var total = 0;
        for(var j = 0; j < group.upgrades.length; j++) total += levelOf(group.upgrades[j])|0;
        globalBoostRanks[key] = total;
    }
    // Precompute per-block global factor (avoids levelOf loops during update)
    var bkeys = Object.keys(GLOBAL_TRANSPORT_BY_BLOCK);
    for(var bi = 0; bi < bkeys.length; bi++){
        var bn = bkeys[bi];
        var ids = GLOBAL_TRANSPORT_BY_BLOCK[bn];
        var gr = 0;
        if(ids != null){
            for(var gi = 0; gi < ids.length; gi++) gr += levelOf(ids[gi])|0;
        }
        globalFactorByBlock[bn] = gr > 0 ? Math.min(1.6, 0.08 * gr) : 0;
    }
    anyBoostActive = hasAnyLocalInstalled();
    if(!anyBoostActive){
        var gk = Object.keys(globalBoostRanks);
        for(var ai = 0; ai < gk.length; ai++){
            if((globalBoostRanks[gk[ai]] || 0) > 0){ anyBoostActive = true; break; }
        }
    }

    try{ scheduleNtTransportRefresh(); }catch(eNt){}
}

function installedBoostData(build){
    var data = {factor:0, aim:0};
    if(build == null || build.block == null) return data;
    var g = BLOCK_GROUPS["" + build.block.name];
    if(g == null || g.globalTransport) return data;
    for(var i = 0; i < g.upgrades.length; i++){
        var id = g.upgrades[i];
        var lv = getApplied(build, id);
        if(lv <= 0) continue;
        var u = UPGRADES[id];
        if(u != null && u.conditional && !conditionSatisfied(build, u)) continue;
        var each = u != null && u.boostEach != null ? u.boostEach : 0.07;
        data.factor += each * lv;
        if(u != null && u.aimBonus != null) data.aim += u.aimBonus * lv;
    }
    return data;
}

function installedRankTotal(build){
    var d = installedBoostData(build);
    return d.factor <= 0 ? 0 : d.factor / 0.07;
}

function hasAnyLocalInstalled(){
    var keys = Object.keys(appliedMap);
    return keys.length > 0;
}

function countInstalledConditionals(build){
    if(build == null || build.block == null) return 0;
    var g = BLOCK_GROUPS["" + build.block.name];
    if(g == null) return 0;
    var count = 0;
    for(var i = 0; i < g.upgrades.length; i++){
        var u = UPGRADES[g.upgrades[i]];
        if(u != null && u.conditional && getApplied(build, u.id) > 0) count++;
    }
    return count;
}

function addMasterAmmo(block, item, sourceItem){
    // ItemTurret acceptance is driven by ammoTypes.  Adding an entry here is enough
    // for already-created ItemTurretBuilds to accept the new item as well.
    if(block == null || item == null || block.ammoTypes == null) return false;
    try{
        if(block.ammoTypes.get(item) != null) return true;
        var base = sourceItem != null ? block.ammoTypes.get(sourceItem) : null;
        if(base == null){
            var entries = block.ammoTypes.entries();
            if(entries != null && entries.hasNext()) base = entries.next().value;
        }
        if(base == null) return false;

        // Duo is a BasicBulletType, so give metaglass its own bullet instead of
        // sharing the copper object. For other turret types, sharing the existing
        // projectile preserves special artillery/flak/shrapnel behavior.
        var bullet = base;
        try{
            var cname = classNameOf(base).toLowerCase();
            if(cname.indexOf("basicbullettype") >= 0){
                var BasicBulletType = Packages.mindustry.entities.bullet.BasicBulletType;
                bullet = new BasicBulletType(base.speed, Math.max(1, base.damage));
                bullet.width = base.width;
                bullet.height = base.height;
                bullet.lifetime = base.lifetime;
                bullet.ammoMultiplier = Math.max(1, base.ammoMultiplier);
                bullet.reloadMultiplier = base.reloadMultiplier;
                bullet.knockback = base.knockback;
                bullet.homingPower = base.homingPower;
                bullet.homingRange = base.homingRange;
                bullet.pierce = base.pierce;
                bullet.pierceCap = base.pierceCap;
                bullet.pierceBuilding = base.pierceBuilding;
                bullet.collidesAir = base.collidesAir;
                bullet.collidesGround = base.collidesGround;
                bullet.collidesTiles = base.collidesTiles;
                bullet.splashDamage = base.splashDamage;
                bullet.splashDamageRadius = base.splashDamageRadius;
                bullet.status = base.status;
                bullet.statusDuration = base.statusDuration;
                bullet.rangeChange = base.rangeChange;
                bullet.velocityRnd = base.velocityRnd;
            }
        }catch(copyErr){}
        block.ammoTypes.put(item, bullet);
        block.hasItems = true;
        return block.ammoTypes.get(item) != null;
    }catch(e){
        return false;
    }
}

function firstUnusedAmmoItem(block, preferred){
    if(block == null || block.ammoTypes == null) return null;
    var candidates = preferred || [];
    for(var i = 0; i < candidates.length; i++){
        var item = candidates[i];
        try{ if(item != null && block.ammoTypes.get(item) == null) return item; }catch(e){}
    }
    return null;
}

function rememberMasterBase(block){
    if(block == null) return null;
    var key = "" + block.name;
    var base = masterBaseState[key];
    if(base != null) return base;
    base = {
        block:block,
        targetAir: block.targetAir,
        range: block.range,
        reload: block.reload,
        itemCapacity: block.itemCapacity,
        liquidCapacity: block.liquidCapacity,
        hasItems: block.hasItems,
        ammo: {}
    };
    try{
        if(block.ammoTypes != null){
            var entries = block.ammoTypes.entries();
            while(entries.hasNext()){
                var e = entries.next();
                base.ammo["" + e.key.id] = {item:e.key, bullet:e.value, collidesAir:e.value == null ? null : e.value.collidesAir};
            }
        }
    }catch(e){}
    masterBaseState[key] = base;
    return base;
}

function restoreMasterBase(block){
    if(block == null) return;
    var base = masterBaseState["" + block.name];
    if(base == null) return;
    try{ if(base.targetAir != null) block.targetAir = base.targetAir; }catch(e){}
    try{ if(base.range != null) block.range = base.range; }catch(e2){}
    try{ if(base.reload != null) block.reload = base.reload; }catch(e3){}
    try{ if(base.itemCapacity != null) block.itemCapacity = base.itemCapacity; }catch(e4){}
    try{ if(base.liquidCapacity != null) block.liquidCapacity = base.liquidCapacity; }catch(e5){}
    try{ if(base.hasItems != null) block.hasItems = base.hasItems; }catch(e6){}
    try{
        if(block.ammoTypes != null){
            // Remove only entries introduced by Tomares, then restore the original
            // projectile map. This keeps vanilla ammo untouched when switching teams.
            var current = block.ammoTypes.entries();
            var remove = [];
            while(current.hasNext()){
                var ce = current.next();
                if(base.ammo["" + ce.key.id] == null) remove.push(ce.key);
            }
            for(var ri = 0; ri < remove.length; ri++) block.ammoTypes.remove(remove[ri]);
            var ids = Object.keys(base.ammo);
            for(var bi = 0; bi < ids.length; bi++){
                var entry = base.ammo[ids[bi]];
                block.ammoTypes.put(entry.item, entry.bullet);
                if(entry.bullet != null && entry.collidesAir != null) entry.bullet.collidesAir = entry.collidesAir;
            }
        }
    }catch(e7){}
}

function addMasterAmmoGlobal(block, item, sourceItem){
    if(block == null || item == null || block.ammoTypes == null) return false;
    return addUsefulAmmoGlobal(block, item, sourceItem, ammoRoleForItem(item));
}

function applyMasterEffectGlobal(block, u){
    if(block == null || u == null || !u.master || levelOf(u.id) <= 0) return;
    rememberMasterBase(block);
    var k = u.masterKind;
    try{
        if(k === "turret-air" || k === "scorch-air"){
            if(block.targetAir != null) block.targetAir = true;
            var ammo = block.ammoTypes;
            if(ammo != null){
                var vals = ammo.values();
                while(vals.hasNext()){
                    var bt = vals.next();
                    if(bt != null && bt.collidesAir != null) bt.collidesAir = true;
                }
            }
        }else if(k === "duo-metaglass" && block === Blocks.duo){
            addUsefulAmmoGlobal(block, Items.metaglass, Items.copper, "stable");
        }else if(k === "turret-ammo"){
            var extra = firstUnusedAmmoItem(block, [
                Items.silicon, Items.metaglass, Items.titanium, Items.thorium,
                Items.plastanium, Items.surgeAlloy, Items.pyratite, Items.blastCompound
            ]);
            if(extra != null) addUsefulAmmoGlobal(block, extra, null, ammoRoleForItem(extra));
        }else if(k === "turret-range"){
            if(block.range != null) block.range = masterBaseState["" + block.name].range * 1.18;
        }else if(k === "turret-response" || k === "turret-burst" || k === "turret-dual"){
            if(block.reload != null) block.reload = Math.max(1, masterBaseState["" + block.name].reload * 0.82);
        }else if(k === "generic-cap" && block.itemCapacity != null){
            block.itemCapacity = Math.max(block.itemCapacity, masterBaseState["" + block.name].itemCapacity + 4);
        }else if(k === "liquid-reserve" && block.liquidCapacity != null){
            block.liquidCapacity = Math.max(block.liquidCapacity, masterBaseState["" + block.name].liquidCapacity * 1.25);
        }else if(k === "arc-chain"){
            if(block.range != null) block.range = masterBaseState["" + block.name].range * 1.12;
        }
    }catch(e){}
}

function activateResearchedMasters(){
    ensureCatalogBuilt();
    // PvP: master cards mutate global Block defs shared by all teams — skip in PvP.
    if(isPvp()){
        try{
            var keys0 = Object.keys(BLOCK_GROUPS);
            for(var r0 = 0; r0 < keys0.length; r0++){
                var g0 = BLOCK_GROUPS[keys0[r0]];
                if(g0 != null && g0.block != null){
                    try{ restoreMasterBase(g0.block()); }catch(eR){}
                }
            }
        }catch(eP){}
        masterAppliedTeamId = currentTeamId();
        masterActivationKey = stateStoreKey();
        return;
    }
    var team = currentTeamId();
    // Master effects are global block definitions. Rebuild them only when the
    // researched team changes or research changes, instead of touching builds.
    // This is intentionally a one-time operation, not a per-frame scan.
    if(masterAppliedTeamId === team && masterActivationKey === stateStoreKey()) return;

    var keys = Object.keys(BLOCK_GROUPS);
    for(var r = 0; r < keys.length; r++){
        var oldGroup = BLOCK_GROUPS[keys[r]];
        if(oldGroup != null && oldGroup.masterUpgrades != null){
            var oldBlock = oldGroup.block();
            if(oldBlock != null) restoreMasterBase(oldBlock);
        }
    }

    for(var i = 0; i < keys.length; i++){
        var g = BLOCK_GROUPS[keys[i]];
        if(g == null || g.masterUpgrades == null) continue;
        var block = g.block();
        if(block == null) continue;
        rememberMasterBase(block);
        for(var j = 0; j < g.masterUpgrades.length; j++){
            var u = MASTER_UPGRADES[g.masterUpgrades[j]];
            if(u != null && levelOf(u.id) > 0) applyMasterEffectGlobal(block, u);
        }
    }
    masterAppliedTeamId = team;
    masterActivationKey = stateStoreKey();
}

function getBuildProgress(build){
    try{ return build.progress(); }catch(e){}
    try{ return Mathf.clamp(build.progress); }catch(e2){}
    return -1;
}

function applyConditionalFactoryRecipes(build){
    if(build == null || build.block == null) return;
    var g = BLOCK_GROUPS["" + build.block.name];
    if(g == null || g.upgrades == null || g.upgrades.length === 0) return;
    var progress = getBuildProgress(build);
    if(progress < 0) return;
    var key = bkey(build);
    var st = factoryRecipeState[key];
    if(st == null){
        st = {last:progress};
        factoryRecipeState[key] = st;
        return;
    }
    var completed = st.last > 0.72 && progress < 0.28;
    st.last = progress;
    if(!completed) return;

    for(var i = 0; i < g.upgrades.length; i++){
        var u = UPGRADES[g.upgrades[i]];
        if(u == null || !u.conditional || u.condition == null || u.condition.recipe == null) continue;
        if(getApplied(build, u.id) <= 0) continue;
        if(!conditionSatisfied(build, u)) continue;
        var r = u.condition.recipe;
        if(r.extraInput <= 0 || r.extraOutput <= 0 || build.items == null) continue;
        try{
            if(build.items.get(r.input) < r.extraInput) continue;
            build.items.remove(r.input, r.extraInput);
            for(var n = 0; n < r.extraOutput; n++) build.offload(r.output);
        }catch(e){}
    }
}

function applyBoostToBuild(build){
    // specialization hook applied inside when factor is known

    if(build == null || build.block == null) return;
    var factor = 1.0;
    var gAdd = globalFactorByBlock["" + build.block.name];
    if(gAdd != null && gAdd > 0) factor += gAdd;
    var data = installedBoostData(build);
    if(data.factor > 0) factor += Math.min(1.8, data.factor);
    if(factor > 3.25) factor = 3.25;
    if(factor > 1.0){
        try{ (function(){
                    try{
                        var cat = categoryOfBlock(build.block);
                        var sm = specMultiplierForCategory(cat);
                        factor = factor * sm;
                    }catch(eSp){}
                    build.applyBoost(factor, BOOST_DURATION);
                })(); }catch(e){}
    }
    // Aim assist only for turrets that already have installed aim bonuses
    if(data.aim > 0){
        try{
            if(build.target != null && build.targetPos != null && !build.isControlled() && !build.logicControlled()){
                var targetRot = Angles.angle(build.x, build.y, build.targetPos.x, build.targetPos.y);
                var extra = build.block.rotateSpeed * Time.delta * Math.min(0.55, data.aim);
                build.rotation = Angles.moveToward(build.rotation, targetRot, extra);
            }
        }catch(e2){}
    }
}


// ============================================================================
// Native transport blocks (lag-free global upgrades)
// Same look as vanilla; when researched, team buildings swap to NT class builds
// that apply speed in-block instead of map-wide applyBoost scans.
// ============================================================================
var NT_TRANSPORT = {}; // vanillaName -> { vanilla, ntName, baseSpeed, baseCapacity, kind }
var NT_TRANSPORT_READY = false;

var NT_TRANSPORT_NAMES = [
    // Serpulo item
    "conveyor", "titanium-conveyor", "plastanium-conveyor", "armored-conveyor",
    "junction", "router", "distributor", "sorter", "inverted-sorter",
    "overflow-gate", "underflow-gate",
    "item-bridge", "phase-conveyor", "mass-driver",
    // Serpulo liquid
    "conduit", "pulse-conduit", "plated-conduit", "bridge-conduit", "phase-conduit",
    "liquid-router", "liquid-container", "liquid-tank",
    // Erekir
    "duct", "armored-duct", "duct-router", "duct-bridge", "duct-unloader",
    "reinforced-conduit", "reinforced-pump", "reinforced-liquid-router",
    "reinforced-liquid-container", "reinforced-liquid-tank",
    "reinforced-bridge-conduit"
];

function isNtTransportName(name){
    if(name == null) return false;
    name = "" + name;
    if(name.indexOf("newtech-nt-") === 0) return true;
    for(var i = 0; i < NT_TRANSPORT_NAMES.length; i++){
        if(NT_TRANSPORT_NAMES[i] === name) return true;
    }
    return false;
}

function transportKindOf(block){
    if(block == null) return null;
    try{
        if(typeof Conduit !== "undefined" && block instanceof Conduit) return "conduit";
    }catch(e0){}
    try{
        if(typeof Duct !== "undefined" && block instanceof Duct) return "duct";
    }catch(e1){}
    try{
        if(typeof StackConveyor !== "undefined" && block instanceof StackConveyor) return "stack";
    }catch(e2){}
    try{
        if(typeof Conveyor !== "undefined" && block instanceof Conveyor) return "conveyor";
    }catch(e3){}
    try{
        if(typeof ArmoredConveyor !== "undefined" && block instanceof ArmoredConveyor) return "conveyor";
    }catch(e4){}
    var n = ("" + block.name).toLowerCase();
    if(n.indexOf("conduit") >= 0 || n.indexOf("liquid") >= 0) return "liquid";
    if(n.indexOf("duct") >= 0) return "duct";
    if(n.indexOf("conveyor") >= 0 || n.indexOf("bridge") >= 0 || n.indexOf("router") >= 0 || n.indexOf("junction") >= 0 || n.indexOf("sorter") >= 0 || n.indexOf("gate") >= 0 || n.indexOf("distributor") >= 0) return "item";
    return null;
}

function globalFactorForBlockName(bname){
    if(bname == null) return 0;
    // Map NT blocks back to vanilla name for research lookup
    var key = "" + bname;
    if(key.indexOf("newtech-nt-") === 0) key = key.substring("newtech-nt-".length);
    var f = globalFactorByBlock[key];
    return f != null ? f : 0;
}

function registerNtTransportClones(){
    if(NT_TRANSPORT_READY && Object.keys(NT_TRANSPORT).length > 0) return;
    NT_TRANSPORT = {};
    for(var i = 0; i < NT_TRANSPORT_NAMES.length; i++){
        var vname = NT_TRANSPORT_NAMES[i];
        try{
            var vanilla = Vars.content.block(vname);
            if(vanilla == null) continue;
            var ntName = "newtech-nt-" + vname;
            var existing = Vars.content.block(ntName);
            // Fallback: global var from extend() at parse time
            if(existing == null){
                try{
                    var gvar = this["NT_BLOCK_" + vname.replace(/-/g, "_")];
                    if(gvar != null) existing = gvar;
                }catch(eG){}
                try{
                    if(existing == null && typeof global !== "undefined"){
                        existing = global["NT_BLOCK_" + vname.replace(/-/g, "_")];
                    }
                }catch(eG2){}
            }
            // Direct known refs
            if(existing == null){
                var map = {
                    "conveyor": NT_BLOCK_conveyor,
                    "titanium-conveyor": NT_BLOCK_titanium_conveyor,
                    "plastanium-conveyor": NT_BLOCK_plastanium_conveyor,
                    "armored-conveyor": NT_BLOCK_armored_conveyor,
                    "junction": NT_BLOCK_junction,
                    "router": NT_BLOCK_router,
                    "distributor": NT_BLOCK_distributor,
                    "sorter": NT_BLOCK_sorter,
                    "inverted-sorter": NT_BLOCK_inverted_sorter,
                    "overflow-gate": NT_BLOCK_overflow_gate,
                    "underflow-gate": NT_BLOCK_underflow_gate,
                    "item-bridge": NT_BLOCK_item_bridge,
                    "phase-conveyor": NT_BLOCK_phase_conveyor,
                    "mass-driver": NT_BLOCK_mass_driver,
                    "conduit": NT_BLOCK_conduit,
                    "pulse-conduit": NT_BLOCK_pulse_conduit,
                    "plated-conduit": NT_BLOCK_plated_conduit,
                    "bridge-conduit": NT_BLOCK_bridge_conduit,
                    "phase-conduit": NT_BLOCK_phase_conduit,
                    "liquid-router": NT_BLOCK_liquid_router,
                    "liquid-container": NT_BLOCK_liquid_container,
                    "liquid-tank": NT_BLOCK_liquid_tank,
                    "duct": NT_BLOCK_duct,
                    "armored-duct": NT_BLOCK_armored_duct,
                    "duct-router": NT_BLOCK_duct_router,
                    "duct-bridge": NT_BLOCK_duct_bridge,
                    "duct-unloader": NT_BLOCK_duct_unloader,
                    "reinforced-conduit": NT_BLOCK_reinforced_conduit,
                    "reinforced-liquid-router": NT_BLOCK_reinforced_liquid_router,
                    "reinforced-liquid-container": NT_BLOCK_reinforced_liquid_container,
                    "reinforced-liquid-tank": NT_BLOCK_reinforced_liquid_tank,
                    "reinforced-bridge-conduit": NT_BLOCK_reinforced_bridge_conduit
                };
                existing = map[vname];
            }
            if(existing == null) continue;
            NT_TRANSPORT[vname] = {
                vanilla: vanilla,
                nt: existing,
                ntName: ntName,
                baseSpeed: vanilla.speed != null ? vanilla.speed : 0,
                baseCapacity: vanilla.capacity != null ? vanilla.capacity : 0,
                kind: transportKindOf(vanilla)
            };
            try{
                existing.localizedName = vanilla.localizedName;
                existing.description = tr(
                    "New Tech class linked to research upgrades. Looks like the original block.",
                    "Classe New Tech ligada as melhorias. Visual igual ao bloco original."
                );
                existing.health = vanilla.health;
                existing.size = vanilla.size;
                existing.requirements = vanilla.requirements;
                existing.category = vanilla.category;
                existing.buildVisibility = BuildVisibility.hidden;
                if(vanilla.speed != null) existing.speed = vanilla.speed;
                if(vanilla.capacity != null) existing.capacity = vanilla.capacity;
                if(vanilla.range != null) existing.range = vanilla.range;
                if(vanilla.liquidCapacity != null) existing.liquidCapacity = vanilla.liquidCapacity;
                ntCopyVisuals(existing, vanilla);
                try{ existing.placeableOn = vanilla.placeableOn; }catch(eP){}
                try{ existing.group = vanilla.group; }catch(eG){}
                try{ existing.instantTransfer = vanilla.instantTransfer; }catch(eI){}
            }catch(eCopy){}
        }catch(e){}
    }
    NT_TRANSPORT_READY = true;
    // Always wire upgrade Build class onto vanilla blocks (sprites stay vanilla)
    try{
        var nms = Object.keys(NT_TRANSPORT);
        for(var ri = 0; ri < nms.length; ri++){
            var en = NT_TRANSPORT[nms[ri]];
            if(en != null && en.vanilla != null) ntAttachVanillaBuildLogic(en.vanilla, nms[ri]);
        }
    }catch(eAtt){}
    Log.info("New Tech's: NT transport registry ready (" + Object.keys(NT_TRANSPORT).length + ")");
}

function applyNtTransportStats(){
    // Never mutate vanilla. NT classes keep base stats; throughput is team-scoped in Build.
    registerNtTransportClones();
}

function replaceTileBlock(tile, block, team, rot){
    // Tile swap disabled for transport: missing multi-region sprites caused shadow-only blocks.
    // Upgrades apply via ntAttachVanillaBuildLogic instead (new Build class, same sprites).
    return false;
}

function convertTeamTransportBuilds(){
    // 1) Revert any shadow NT builds back to vanilla
    // 2) Attach team-scoped upgrade Build logic on vanilla transport blocks
    if(Vars.state == null || !Vars.state.isGame() || Vars.player == null) return;
    registerNtTransportClones();
    var team = Vars.player.team();
    var reverted = 0;
    try{
        Groups.build.each(function(b){
            try{
                if(b == null || !b.isValid() || b.team !== team) return;
                var block = b.block;
                if(block == null || block.name == null) return;
                var name = "" + block.name;
                if(name.indexOf("newtech-nt-") !== 0) return;
                var vanillaName = name.substring("newtech-nt-".length);
                var entry = NT_TRANSPORT[vanillaName];
                if(entry == null || entry.vanilla == null) return;
                try{
                    b.tile.setBlock(entry.vanilla, team, b.rotation);
                    reverted++;
                }catch(e1){
                    try{ b.tile.setNet(entry.vanilla, team, b.rotation); reverted++; }catch(e2){}
                }
            }catch(eOne){}
        });
    }catch(e){}
    // Attach logic to all known vanilla transport blocks
    try{
        var names = Object.keys(NT_TRANSPORT);
        for(var i = 0; i < names.length; i++){
            var e = NT_TRANSPORT[names[i]];
            if(e != null && e.vanilla != null) ntAttachVanillaBuildLogic(e.vanilla, names[i]);
        }
    }catch(eA){}
    try{
        if(reverted > 0) Log.info("New Tech's: reverted " + reverted + " shadow NT builds to vanilla");
        Log.info("New Tech's: transport upgrades use vanilla sprites + new Build class");
    }catch(eL){}
}

// Do not swap on build — keeps sprites correct
Events.on(BlockBuildEndEvent, function(e){
    try{
        if(e == null || e.breaking) return;
        if(Vars.player == null) return;
        if(e.team != null && e.team !== Vars.player.team()) return;
        var tile = e.tile;
        if(tile == null || tile.build == null || tile.build.block == null) return;
        var name = "" + tile.build.block.name;
        // If somehow an NT shadow was placed, revert
        if(name.indexOf("newtech-nt-") === 0){
            var vn = name.substring("newtech-nt-".length);
            var entry = NT_TRANSPORT[vn];
            if(entry != null && entry.vanilla != null){
                try{ tile.setBlock(entry.vanilla, Vars.player.team(), tile.build.rotation); }catch(eR){}
            }
        }
    }catch(err){}
});

function scheduleNtTransportRefresh(){
    try{
        Core.app.post(function(){
            try{
                registerNtTransportClones();
                applyNtTransportStats();
                convertTeamTransportBuilds();
            }catch(e){ Log.err("New Tech's NT transport refresh: " + e); }
        });
    }catch(e2){}
}

function rescanBoostTargets(){
    cachedBoostTargets = [];
    cachedBoostTargetKeys = {};
    if(Vars.state == null || !Vars.state.isGame() || Vars.player == null) return;
    if(!anyBoostActive) return;
    var team = Vars.player.team();
    Groups.build.each(function(b){
        try{
            if(b == null || !b.isValid() || b.team != team) return;
            var bn = "" + b.block.name;
            // Prefer NT class; only skip applyBoost when NT visuals are ready
            if(isNtTransportName(bn) || transportKindOf(b.block) != null){
                var vname = bn.indexOf("newtech-nt-") === 0 ? bn.substring("newtech-nt-".length) : bn;
                var ent = NT_TRANSPORT[vname];
                if(ent != null && ntVisualReady(ent.nt)) return;
            }
            var hasGlobal = (globalFactorByBlock[bn] != null && globalFactorByBlock[bn] > 0);
            var hasLocal = appliedMap[bkey(b)] != null;
            if(hasGlobal || hasLocal) addCachedBoostTarget(b);
        }catch(e){}
    });
}

Events.run(Trigger.update, function(){
    if(Vars.state == null || !Vars.state.isGame() || Vars.player == null) return;
    if(Time == null) return;
    if(!anyBoostActive) return;

    // Rare full map scan to refresh the small target list
    if(Time.time - lastScanTick >= SCAN_TICK_INTERVAL){
        lastScanTick = Time.time;
        rescanBoostTargets();
    }

    // Apply boosts only to cached targets (not every building)
    if(Time.time - lastBoostTick < BOOST_TICK_INTERVAL) return;
    lastBoostTick = Time.time;

    var list = cachedBoostTargets;
    for(var i = 0; i < list.length; i++){
        var b = list[i];
        if(b == null || !b.isValid()) continue;
        try{ applyBoostToBuild(b); }catch(e){}
        try{ applyConditionalFactoryRecipes(b); }catch(eRecipe){}
    }
});

function showInstallDialog(build, restoreScrollY){
    if(build == null) return;
    var ups = upgradesForBlock(build.block);
    if(ups.length === 0) return;

    var dialog = new BaseDialog(tr("Install Upgrades", "Instalar Upgrades") + " — " + build.block.localizedName);
    dialog.addCloseButton();

    var body = new Table();
    body.defaults().pad(6).growX();
    var installPane = null;
    body.add("[accent]" + build.block.localizedName).row();
    body.add("[gray]" + tr("Install researched upgrades on this building.", "Instale upgrades pesquisados neste predio.")).wrap().padBottom(4).row();

    for(var i = 0; i < ups.length; i++){
        (function(u){
            var researched = levelOf(u.id);
            var installed = getApplied(build, u.id);
            var cores = researchCores();
            var nextInstall = installed + 1;
            var umax = (u.max != null ? u.max : (u.maxLevel != null ? u.maxLevel : 1));
            var canInstall = researched > installed && installed < umax;
            if(u.conditional && installed <= 0 && countInstalledConditionals(build) >= 2) canInstall = false;
            var cost = canInstall ? installCost(u, nextInstall) : [];
            var afford = canInstall && canFull(cores, cost);
            var noRes = canInstall && !afford;

            body.table(Tex.button, function(tbl){
                tbl.left().defaults().left().pad(4);
                tbl.add("[accent]" + upgradeDisplayName(u)).growX().wrap().row();
                var dtxt = upgradeDisplayDesc(u, Math.max(1, installed + 1));
                if(dtxt) tbl.add("[lightgray]" + dtxt).growX().wrap().row();
                tbl.add("[gray]" + researched + " " + tr("researched", "pesquisado") + "  •  " + installed + "/" + umax + " " + tr("installed", "instalado")).row();
                if(u.conditional){
                    var ct = conditionText(u.condition);
                    tbl.add("[yellow]" + tr("WHEN: ", "QUANDO: ") + tr(ct.en, ct.pt)).wrap().row();
                    tbl.add(conditionSatisfied(build, u) ? "[lime]" + conditionStatusText(build, u) : "[scarlet]" + conditionStatusText(build, u)).wrap().row();
                    if(installed <= 0 && countInstalledConditionals(build) >= 2) tbl.add("[scarlet]" + tr("Maximum of 2 conditional cards installed on this block.", "Máximo de 2 cards condicionais instalados neste bloco.")).wrap().row();
                }
                if(researched <= 0){
                    tbl.add("[scarlet]" + tr("Not researched", "Nao pesquisado")).row();
                }else if(installed >= researched || installed >= u.max){
                    tbl.add("[lime]" + tr("Installed", "Instalado")).row();
                }else{
                    tbl.add((noRes?"[scarlet]":"[lightgray]") + costText(cost)).wrap().row();
                }
                tbl.button(tr("Install", "Instalar"), Icon.up, function(){
                    var keepScrollY = 0;
                    try{ if(installPane != null) keepScrollY = installPane.getScrollY(); }catch(e){}
                    var freshResearched = levelOf(u.id);
                    var freshInstalled = getApplied(build, u.id);
                    var freshNext = freshInstalled + 1;
                    var umax2 = (u.max != null ? u.max : (u.maxLevel != null ? u.maxLevel : 1));
                    var freshCanInstall = freshResearched > freshInstalled && freshInstalled < umax2;
                    if(u.conditional && freshInstalled <= 0 && countInstalledConditionals(build) >= 2) freshCanInstall = false;
                    var freshCost = freshCanInstall ? installCost(u, freshNext) : [];
                    var freshCores = researchCores();
                    if(!freshCanInstall){
                        Vars.ui.showInfo(freshResearched <= 0 ? tr("Research this upgrade first.", "Pesquise esta melhoria primeiro.") : tr("This upgrade is already installed or blocked.", "Esta melhoria ja esta instalada ou bloqueada."));
                        return;
                    }
                    if(!canFull(freshCores, freshCost)){
                        Vars.ui.showInfo(tr("Not enough items in your team's cores.", "Nao ha recursos suficientes nos nucleos do seu time."));
                        return;
                    }
                    payStacks(freshCores, freshCost);
                    setApplied(build, u.id, freshNext);
                    dialog.hide();
                    Core.app.post(function(){ showInstallDialog(build, keepScrollY); });
                }).disabled(false).size(Vars.mobile?160:180, Vars.mobile?42:48).padTop(2);
            }).growX().row();
        })(ups[i]);
    }

    var mg = BLOCK_GROUPS["" + build.block.name];
    if(mg != null && mg.masterUpgrades != null && mg.masterUpgrades.length > 0){
        body.add("[accent]MASTER UPGRADES // BUILT-IN").padTop(14).row();
        body.add("[gray]" + tr("Master applies automatically after research.", "Master aplica sozinho apos pesquisar.")).wrap().row();
        for(var mii = 0; mii < mg.masterUpgrades.length; mii++){
            (function(u){
                var unlocked = levelOf(u.id) > 0;
                body.table(Styles.none, function(tbl){
                    tbl.left().defaults().left().pad(3);
                    tbl.add((unlocked ? "[lime]★ " : "[gray]☆ ") + upgradeDisplayName(u)).growX().wrap().row();
                    tbl.add("[lightgray]" + upgradeDisplayDesc(u, 1)).growX().wrap().row();
                    tbl.add(unlocked ? "[lime]" + tr("UNLOCKED — included in construction", "DESBLOQUEADO — incluído na construção") : "[gray]" + tr("Research this Master Upgrade to include it in construction.", "Pesquise este Master Upgrade para incluí-lo na construção.")).wrap().row();
                }).growX().row();
            })(MASTER_UPGRADES[mg.masterUpgrades[mii]]);
        }
    }

    installPane = dialog.cont.pane(body).grow().pad(8).get();
    dialog.show();
    if(restoreScrollY != null){
        try{
            Core.app.post(function(){
                try{ installPane.setScrollY(restoreScrollY); }catch(e){}
            });
        }catch(e){}
    }
}

function setupSelectUi(){
    try{
        if(selectTable != null){
            try{ selectTable.remove(); }catch(e0){}
        }
        selectTable = new Table();

        var barW = Vars.mobile ? 300 : 280;
        var barH = 52;
        var hasSaved = Core.settings.has(INSTALL_BAR_X) && Core.settings.has(INSTALL_BAR_Y);
        var sx, sy;
        if(hasSaved){
            sx = Core.settings.getFloat(INSTALL_BAR_X, 0);
            sy = Core.settings.getFloat(INSTALL_BAR_Y, 0);
            sx = Mathf.clamp(sx, 0, Math.max(0, Core.graphics.getWidth() - barW));
            sy = Mathf.clamp(sy, 0, Math.max(0, Core.graphics.getHeight() - barH));
            selectTable.setSize(barW, barH);
            selectTable.setPosition(sx, sy);
        }else{
            // Default: bottom center, always visible on screen
            selectTable.setFillParent(true);
            selectTable.bottom().marginBottom(Vars.mobile ? 120 : 80);
        }

        var dragging = false;
        var dragDx = 0, dragDy = 0;

        var inner = new Table(Tex.pane);
        inner.defaults().pad(3);

        // Move handle
        var moveBtn = inner.button(Icon.resize, Styles.cleari, function(){}).size(42, 42).get();
        try{
            moveBtn.addListener(extend(InputListener, {
                touchDown: function(event, x, y, pointer, button){
                    // If still fill-parent, convert to free floating at current visual pos
                    if(selectTable.getWidth() >= Core.graphics.getWidth() - 4){
                        selectTable.setFillParent(false);
                        selectTable.setSize(barW, barH);
                        selectTable.setPosition((Core.graphics.getWidth() - barW) / 2, Vars.mobile ? 120 : 80);
                    }
                    dragging = true;
                    dragDx = x;
                    dragDy = y;
                    return true;
                },
                touchDragged: function(event, x, y, pointer){
                    if(!dragging) return;
                    var nx = selectTable.x + (x - dragDx);
                    var ny = selectTable.y + (y - dragDy);
                    nx = Mathf.clamp(nx, 0, Math.max(0, Core.graphics.getWidth() - selectTable.getWidth()));
                    ny = Mathf.clamp(ny, 0, Math.max(0, Core.graphics.getHeight() - selectTable.getHeight()));
                    selectTable.setPosition(nx, ny);
                },
                touchUp: function(event, x, y, pointer, button){
                    if(dragging){
                        try{
                            Core.settings.put(INSTALL_BAR_X, java.lang.Float(selectTable.x));
                            Core.settings.put(INSTALL_BAR_Y, java.lang.Float(selectTable.y));
                        }catch(eSave){
                            try{
                                Core.settings.put(INSTALL_BAR_X, selectTable.x);
                                Core.settings.put(INSTALL_BAR_Y, selectTable.y);
                            }catch(e2){}
                        }
                    }
                    dragging = false;
                }
            }));
        }catch(eLis){}

        inner.button(tr("Install", "Instalar"), Icon.up, function(){
            if(lastSelected != null) showInstallDialog(lastSelected);
        }).size(Vars.mobile ? 120 : 110, 42);
        inner.button(tr("Cancel", "Cancelar"), Icon.cancel, function(){
            lastSelected = null;
            pendingSelectBuild = null;
            pendingSelectTime = -999999;
        }).size(Vars.mobile ? 90 : 80, 42);

        if(hasSaved){
            selectTable.add(inner);
        }else{
            selectTable.add(inner).pad(2);
        }

        selectTable.visible = false;
        selectTable.touchable = Touchable.enabled;
        Core.scene.add(selectTable);
        Log.info("Tomares: install bar ready");
    }catch(e){
        Log.err("Tomares setupSelectUi: " + e);
    }
}

Events.on(TapEvent, function(e){
    try{
        // Client-only: never show selection UI for other players
        if(Vars.headless) return;
        if(e.tile == null || e.tile.build == null || Vars.player == null) return;
        try{ if(e.player != null && e.player !== Vars.player) return; }catch(eP){}
        var build = e.tile.build;
        if(build.team != Vars.player.team()) return;
        if(upgradesForBlock(build.block).length <= 0) return;

        var now = Time.time;
        var same = pendingSelectBuild === build;
        var fastEnough = (now - pendingSelectTime) <= DOUBLE_TAP_WINDOW;

        // First click only arms the double-click. No mod UI/highlight is shown yet.
        if(!same || !fastEnough){
            pendingSelectBuild = build;
            pendingSelectTime = now;
            return;
        }

        // Second click confirms the selection. Only now does the client-side highlight/UI appear.
        pendingSelectBuild = null;
        pendingSelectTime = -999999;
        lastSelected = build;
        selectCacheKey = "" + build.block.name;
    }catch(err){}
});

// Client-only visual feedback for the confirmed double-click selection.
Events.run(Trigger.draw, function(){
    try{
        if(Vars.headless || Vars.player == null || lastSelected == null) return;
        var b = lastSelected;
        if(!b.isValid() || b.team != Vars.player.team()) return;
        var size = b.block != null ? b.block.size : 1;
        var radius = (size * Vars.tilesize) / 2 + 2;
        Draw.z(Layer.blockOver + 1);
        Draw.color(Color.yellow);
        Lines.stroke(1.5);
        Lines.square(b.x, b.y, radius);
        Draw.reset();
    }catch(e){}
});

// Draw installed drill upgrades directly above the drill sprite.
Events.run(Trigger.draw, function(){
    try{ drawDrillUpgradeOverlays(); }catch(e){}
});


// ---------- Drill upgrade overlay sprites ----------
// Sprite variants are authored around a 3x3 / 96px drill. A dedicated 2x2
// water texture is used where supplied by the asset pack.
var DRILL_SPEED_1_REGION = null;
var DRILL_SPEED_2_REGION = null;
var DRILL_SPEED_3_REGION = null;
var DRILL_WATER_3_REGION = null;
var DRILL_WATER_2_REGION = null;

function drillOverlayRegion(name){
    try{
        return Core.atlas.find("new-techs-" + name);
    }catch(e){
        return null;
    }
}

function isNewTechDrillBlock(block){
    if(block == null) return false;
    try{
        var g = BLOCK_GROUPS["" + block.name];
        if(g != null && g.isDrillGroup) return true;
    }catch(e){}
    try{
        var cls = classNameOf(block).toLowerCase();
        var n = ("" + block.name).toLowerCase();
        return cls.indexOf("drill") >= 0 || n.indexOf("drill") >= 0;
    }catch(e2){}
    return false;
}

function drillSpeedUpgradeForBlock(block){
    try{
        var g = BLOCK_GROUPS["" + block.name];
        if(g == null || g.upgrades == null) return null;
        // Drill core #1 is the speed upgrade in the New Tech's drill groups.
        // Keep this data-driven so both the original named upgrades and the
        // generated v4 groups use the same overlay logic.
        for(var i = 0; i < g.upgrades.length; i++){
            var u = UPGRADES[g.upgrades[i]];
            if(u == null || u.conditional) continue;
            if((u.max|0) >= 3) return u;
        }
    }catch(e){}
    return null;
}

function drillOverlayState(build){
    var state = {speedLevel:0, water:false};
    if(build == null || build.block == null || !isNewTechDrillBlock(build.block)) return state;

    try{
        var speedUp = drillSpeedUpgradeForBlock(build.block);
        if(speedUp != null) state.speedLevel = Math.min(3, getApplied(build, speedUp.id)|0);
    }catch(e){}

    // A water/liquid conditional texture is an INSTALLATION marker: once the
    // conditional upgrade is installed, keep its texture visible. It no longer
    // waits for the water condition to be currently satisfied.
    try{
        var g = BLOCK_GROUPS["" + build.block.name];
        if(g != null && g.upgrades != null){
            for(var i = 0; i < g.upgrades.length; i++){
                var u = UPGRADES[g.upgrades[i]];
                if(u == null || !u.conditional || getApplied(build, u.id) <= 0) continue;
                if(u.condition != null && u.condition.mode === "liquid"){
                    state.water = true;
                    break;
                }
            }
        }
    }catch(e2){}
    return state;
}

function drawDrillUpgradeOverlays(){
    if(Vars.headless) return;

    if(DRILL_SPEED_2_REGION == null){
        DRILL_SPEED_1_REGION = drillOverlayRegion("drill-upgrade-speed-1of3");
        DRILL_SPEED_2_REGION = drillOverlayRegion("drill-upgrade-speed-2of3");
        DRILL_SPEED_3_REGION = drillOverlayRegion("drill-upgrade-speed-3of3");
        DRILL_WATER_3_REGION = drillOverlayRegion("water-condition-upgrade");
        DRILL_WATER_2_REGION = drillOverlayRegion("2x2-drill-water-upgrade");
    }

    var targets = cachedBoostTargets || [];
    if(targets.length === 0) return;

    for(var ti = 0; ti < targets.length; ti++){
        var build = targets[ti];
        try{
            if(build == null || !build.isValid() || build.block == null) continue;
            if(!isNewTechDrillBlock(build.block)) continue;

            var state = drillOverlayState(build);
            if(state.speedLevel <= 1 && !state.water) continue;

            var size = Math.max(1, build.block.size || 1);
            var worldSize = size * Vars.tilesize;

            // Water texture must sit above the drill body but UNDER the rotating
            // part. Drill.java draws rotator/top starting at blockAfterCracks.
            // A tiny offset keeps this layer below the rotator without hiding it.
            if(state.water){
                var waterRegion = size === 2 && DRILL_WATER_2_REGION != null && DRILL_WATER_2_REGION.found()
                    ? DRILL_WATER_2_REGION
                    : DRILL_WATER_3_REGION;
                if(waterRegion != null && waterRegion.found()){
                    Draw.z(Layer.blockAfterCracks - 0.01);
                    Draw.rect(waterRegion, build.x, build.y, worldSize, worldSize);
                }
            }

            // Speed upgrades are always on top of the drill's rotator/top layers.
            var speedRegion = state.speedLevel >= 3 ? DRILL_SPEED_3_REGION :
                (state.speedLevel >= 2 ? DRILL_SPEED_2_REGION :
                (state.speedLevel >= 1 ? DRILL_SPEED_1_REGION : null));
            if(speedRegion != null && speedRegion.found()){
                Draw.z(Layer.blockOver + 0.1);
                Draw.rect(speedRegion, build.x, build.y, worldSize, worldSize);
            }

            Draw.reset();
        }catch(e){}
    }
}

function addHudResearch(){
    try{
        if(researchHudTable != null){
            try{ researchHudTable.remove(); }catch(eR){}
        }
        researchHudTable = new Table();
        researchHudTable.setFillParent(true);
        researchHudTable.top().right().margin(10);
        // Big obvious button so it never "disappears" on mobile
        researchHudTable.button(Icon.book, Styles.defaulti, function(){
            showResearchDialog();
        }).size(Vars.mobile ? 64 : 56, Vars.mobile ? 64 : 56).name("tomares-hud-research").tooltip(tr("New Tech's", "New Tech's"));
        researchHudTable.visible = true;
        Core.scene.add(researchHudTable);
        Log.info("Tomares: research HUD button added");
    }catch(e){
        Log.err("Tomares HUD: " + e);
        // Last resort: absolute positioned table
        try{
            researchHudTable = new Table();
            researchHudTable.setSize(64, 64);
            researchHudTable.setPosition(Core.graphics.getWidth() - 74, Core.graphics.getHeight() - 120);
            researchHudTable.button(tr("T", "T"), function(){ showResearchDialog(); }).size(64, 64);
            Core.scene.add(researchHudTable);
        }catch(e2){ Log.err("Tomares HUD fallback: " + e2); }
    }
}

Events.on(ClientLoadEvent, function(e){
    if(!Core.settings.has(LANG_KEY)) Core.settings.put(LANG_KEY, "en");
    loadHistory();
    setupNetHandlers();
    ensureCatalogBuilt();
    refreshGlobalBoostRanks();
    try{ applyAllBulletUpgrades(); }catch(e0){}

    try{
        Vars.ui.settings.addCategory("New Tech's", Icon.settings, function(st){
            st.table(Styles.none, function(r){
                r.add("Language / Idioma").row();
                r.button("English", function(){ Core.settings.put(LANG_KEY,"en"); Vars.ui.showInfo("Language: English"); }).size(200,50).row();
                r.button("Português", function(){ Core.settings.put(LANG_KEY,"pt"); Vars.ui.showInfo("Idioma: Português"); }).size(200,50).row();
                r.button("Español", function(){ Core.settings.put(LANG_KEY,"es"); Vars.ui.showInfo("Idioma: Español"); }).size(200,50).row();
                r.button("Tiếng Việt", function(){ Core.settings.put(LANG_KEY,"vi"); Vars.ui.showInfo("Ngôn ngữ: Tiếng Việt"); }).size(200,50).row();
                r.add("HUD").padTop(8).row();
                r.button(tr("Open research", "Abrir pesquisa"), function(){
                    showResearchDialog();
                }).size(260,50).row();
                r.button(tr("Restore progress", "Restaurar progresso"), Icon.refresh, function(){
                    restoreProgressEffects();
                }).size(260,50).row();
                r.button(tr("Reset install bar position", "Resetar posicao da barra"), function(){
                    Core.settings.remove(INSTALL_BAR_X);
                    Core.settings.remove(INSTALL_BAR_Y);
                    try{ setupSelectUi(); }catch(eR){}
                    Vars.ui.showInfo(tr("Install bar position reset.", "Posicao da barra resetada."));
                }).size(260,50).row();
                r.add("[scarlet]" + tr("Danger", "Perigo")).padTop(10).row();
                r.button(tr("Reset all progress", "Resetar todo progresso"), Icon.trash, function(){
                    Vars.ui.showConfirm(
                        tr("Reset ALL research progress for New Tech's? This cannot be undone.",
                           "Resetar TODO o progresso de pesquisa do New Tech's? Nao da para desfazer."),
                        function(){ resetAllProgress(); }
                    );
                }).size(260,50).row();
            }).growX().pad(8);
        });
    }catch(err){}

    Vars.ui.paused.shown(function(){
        pauseBtnInjected = false;
        // Re-apply research while opening pause so changes made from the research
        // dialog are visible immediately instead of waiting for gameplay to resume.
        Core.app.post(function(){ try{ refreshResearchEffectsNow(); }catch(eRefreshPause){} });
        Core.app.post(function(){ injectCategoryMainButton(); });
        // second pass after Mindustry finishes rebuilding the pause grid
        Timer.schedule(function(){ try{ injectCategoryMainButton(); }catch(e){} }, 0.05);
        Timer.schedule(function(){ try{ injectCategoryMainButton(); }catch(e){} }, 0.2);
    });
    try{
        Vars.ui.paused.hidden(function(){
            try{ if(pauseTechTable != null) pauseTechTable.visible = false; }catch(e){}
        });
    }catch(eH){}

    addHudResearch();
    setupSelectUi();

    // Lightweight UI visibility — throttled, no per-frame catalog work
    var lastUiTick = 0;
    var cachedSelectOk = false;
    Events.run(Trigger.update, function(){
        try{
            if(Time != null && Time.time - lastUiTick < 40) return; // ~1.5 times/sec (FPS)
            lastUiTick = Time != null ? Time.time : lastUiTick + 12;
            var inGame = Vars.state != null && Vars.state.isGame();
            var paused = Vars.ui != null && Vars.ui.paused != null && Vars.ui.paused.isShown();
            if(researchHudTable != null) researchHudTable.visible = inGame && !paused;
            if(pauseTechTable != null){ pauseTechTable.visible = paused; if(paused){ try{ pauseTechTable.toFront(); }catch(eZ){} } }
            if(selectTable != null){
                var b = lastSelected;
                if(b == null || !b.isValid() || !inGame || Vars.player == null || b.team !== Vars.player.team()){
                    selectTable.visible = false;
                }else{
                    selectTable.visible = (!Vars.headless && lastSelected != null);
                }
            }
        }catch(eVis){}
    });
});

Events.on(WorldLoadEvent, function(e){
    persistentLevels = {};
    persistentPartial = {};
    persistentMissions = {};
    persistentPoints = 0;
    persistentShop = null;
    persistentPointMissions = null;
    activeStoreKey = null;
    activeTagKey = null;
    loadPersistentState();
    try{ Core.app.post(function(){ registerNtTransportClones(); applyNtTransportStats(); convertTeamTransportBuilds(); }); }catch(eNtW){}
    try{
        // After assets load, copy vanilla sprites again and fix any shadow builds
        Core.app.post(function(){
            try{
                registerNtTransportClones();
                var names = Object.keys(NT_TRANSPORT);
                for(var i = 0; i < names.length; i++){
                    var e = NT_TRANSPORT[names[i]];
                    if(e != null) ntCopyVisuals(e.nt, e.vanilla);
                }
                convertTeamTransportBuilds();
            }catch(eCL){}
        });
    }catch(eNtC){}
    appliedMap = {};
    cachedBoostTargets = [];
    cachedBoostTargetKeys = {};
    lastScanTick = -1000;
    lastBoostTick = -1000;
    ensureCatalogBuilt();
    refreshGlobalBoostRanks();
    // The catalog is built before a world exists on ClientLoad; after WorldLoad
    // the persistent research state is finally available, so apply researched
    // custom ammo now and again after any network tag/sync step.
        masterAppliedTeamId = -1;
    masterActivationKey = null;
    try{ activateResearchedMasters(); }catch(err){}
    try{ applyAllBulletUpgrades(); }catch(errB){}
    try{
        if(Vars.net != null && Vars.net.client()) requestSyncFromHost();
        else readHostTags();
        if(Vars.net != null && Vars.net.server()) broadcastSync();
    }catch(errN){}
    lastBoostTick = -1000;
    lastSelected = null;
});

Events.on(SaveWriteEvent, function(e){
    try{ savePersistentState(true); }catch(err){}
});

Events.on(ResetEvent, function(e){
    try{ savePersistentState(true); }catch(err){}
});

Events.on(DisposeEvent, function(e){
    try{ savePersistentState(true); }catch(err){}
});

Events.on(StateChangeEvent, function(e){
    try{ savePersistentState(true); }catch(err){}
    });


// ============================================================================
// NEW TECH'S — Master missions, point missions, shop
// ============================================================================

function progressBarText(frac, done){
    var n = 10;
    var f = frac;
    if(f < 0) f = 0;
    if(f > 1) f = 1;
    var filled = Math.round(f * n);
    var s = done ? "[lime]" : "[accent]";
    for(var i = 0; i < n; i++) s += (i < filled ? "█" : "░");
    s += "[]";
    return s;
}

function resourceProgressFraction(rem, cores){
    if(rem == null || rem.length === 0) return 1;
    var have = 0, need = 0;
    for(var i = 0; i < rem.length; i++){
        var r = rem[i];
        if(r == null || r.item == null) continue;
        need += r.amount;
        var got = 0;
        try{
            for(var c = 0; c < cores.length; c++){
                if(cores[c] != null && cores[c].items != null) got += cores[c].items.get(r.item)|0;
            }
        }catch(e){}
        have += Math.min(r.amount, got);
    }
    if(need <= 0) return 1;
    return have / need;
}

// ---- Master missions ----
function ensureMasterMission(u, block, index){
    if(u == null) return;
    if(u.mission != null) return;
    var bname = block != null ? (""+block.name) : "block";
    var idx = index|0;
    if(idx === 0){
        u.mission = { type: "build", target: 30, blockName: bname };
    }else if(idx === 1){
        u.mission = { type: "water", target: 1, blockName: bname };
    }else{
        u.mission = { type: "build", target: 45 + idx * 10, blockName: bname };
    }
    if(persistentMissions[u.id] == null){
        persistentMissions[u.id] = { progress: 0, done: false };
    }
}

function getMasterMissionProgress(id){
    var m = persistentMissions[id];
    if(m == null) return 0;
    return m.progress|0;
}

function getMasterMissionTarget(id){
    var u = MASTER_UPGRADES[id];
    if(u == null || u.mission == null) return 1;
    return u.mission.target|0;
}

function isMasterMissionComplete(id){
    var m = persistentMissions[id];
    if(m != null && m.done) return true;
    var u = MASTER_UPGRADES[id];
    if(u == null || u.mission == null) return true;
    var p = m != null ? (m.progress|0) : 0;
    return p >= (u.mission.target|0);
}

function masterMissionLabel(id){
    var u = MASTER_UPGRADES[id];
    if(u == null || u.mission == null) return tr("None", "Nenhuma");
    var m = u.mission;
    var block = null;
    try{ if(u.block != null) block = u.block(); }catch(e){}
    var loc = block != null ? (""+block.localizedName) : (m.blockName || "?");
    if(m.type === "water"){
        return tr("Place water in this block for the first time (" + loc + ")", "Colocar água neste bloco pela primeira vez (" + loc + ")");
    }
    return tr("Build this block " + m.target + " times (" + loc + ")", "Construir este bloco " + m.target + " vezes (" + loc + ")");
}

function bumpMasterMission(type, blockName, amount){
    if(blockName == null) return;
    try{ ensurePersistentState(); }catch(eE){}
    amount = amount || 1;
    var ids = Object.keys(MASTER_UPGRADES);
    var changed = false;
    for(var i = 0; i < ids.length; i++){
        var u = MASTER_UPGRADES[ids[i]];
        if(u == null || u.mission == null) continue;
        if(u.mission.type !== type) continue;
        if((""+u.mission.blockName) !== (""+blockName)) continue;
        if(persistentMissions[u.id] == null) persistentMissions[u.id] = { progress: 0, done: false };
        var st = persistentMissions[u.id];
        if(st.done) continue;
        st.progress = (st.progress|0) + amount;
        if(st.progress >= (u.mission.target|0)){
            st.progress = u.mission.target|0;
            st.done = true;
        }
        changed = true;
    }
    if(changed){
        try{ savePersistentState(false); }catch(e){}
    }
}

// ---- Points / rarity ----
var RARITY_WEIGHTS = { common: 50, uncommon: 25, rare: 15, epic: 7, legendary: 3 };
var RARITY_COLOR = {
    common: "[white]", uncommon: "[#81c784]", rare: "[#64b5f6]",
    epic: "[#ba68c8]", legendary: "[#ffd54f]"
};

function rollRarity(){
    var total = 0;
    var keys = Object.keys(RARITY_WEIGHTS);
    for(var i = 0; i < keys.length; i++) total += RARITY_WEIGHTS[keys[i]];
    var r = Math.random() * total;
    var acc = 0;
    for(var j = 0; j < keys.length; j++){
        acc += RARITY_WEIGHTS[keys[j]];
        if(r <= acc) return keys[j];
    }
    return "common";
}

function rarityPointsReward(rarity){
    if(rarity === "legendary") return 1200 + ((Math.random()*800)|0);
    if(rarity === "epic") return 700 + ((Math.random()*500)|0);
    if(rarity === "rare") return 350 + ((Math.random()*250)|0);
    if(rarity === "uncommon") return 180 + ((Math.random()*120)|0);
    return 100 + ((Math.random()*80)|0);
}

function addPoints(n){
    persistentPoints = (persistentPoints|0) + (n|0);
    if(persistentPoints < 0) persistentPoints = 0;
    try{ savePersistentState(false); }catch(e){}
}

function spendPoints(n){
    n = n|0;
    if((persistentPoints|0) < n) return false;
    persistentPoints = (persistentPoints|0) - n;
    try{ savePersistentState(false); }catch(e){}
    return true;
}

// ---- Point missions (shop points, not master) ----

// Mode-aware point missions + dual shared shops (items / units), 10 slots, stock

function currentGameModeKey(){
    try{
        if(isCampaign()) return "campaign";
        if(isPvp()) return "pvp";
        var r = Vars.state != null ? Vars.state.rules : null;
        if(r == null) return "custom";
        if(r.editor) return "editor";
        if(r.attackMode) return "attack";
        if(r.infiniteResources) return "sandbox";
        if(r.waves) return "survival";
        return "custom";
    }catch(e){ return "custom"; }
}

function modeMissionPool(){
    var mode = currentGameModeKey();
    var pool = [];
    // Always available
    pool.push({ type: "build_any", target: 25, rarity: "common", en: "Build any 25 blocks", pt: "Construa 25 blocos quaisquer" });
    pool.push({ type: "build_any", target: 80, rarity: "uncommon", en: "Build any 80 blocks", pt: "Construa 80 blocos quaisquer" });
    pool.push({ type: "build_any", target: 200, rarity: "rare", en: "Build any 200 blocks", pt: "Construa 200 blocos quaisquer" });
    pool.push({ type: "core_items", target: 100, rarity: "common", en: "Deposit 100 items into cores", pt: "Deposite 100 itens nos nucleos" });
    pool.push({ type: "core_items", target: 500, rarity: "common", en: "Deposit 500 items into cores", pt: "Deposite 500 itens nos nucleos" });
    pool.push({ type: "core_items", target: 1500, rarity: "uncommon", en: "Deposit 1500 items into cores", pt: "Deposite 1500 itens nos nucleos" });
    pool.push({ type: "core_items", target: 3000, rarity: "uncommon", en: "Deposit 3000 items into cores", pt: "Deposite 3000 itens nos nucleos" });

    if(mode === "pvp" || mode === "attack"){
        pool.push({ type: "destroy_enemy", target: 1, rarity: "common", en: "Destroy 1 enemy building", pt: "Destrua 1 predio inimigo" });
        pool.push({ type: "destroy_enemy", target: 3, rarity: "common", en: "Destroy 3 enemy buildings", pt: "Destrua 3 predios inimigos" });
        pool.push({ type: "destroy_enemy", target: 5, rarity: "common", en: "Destroy 5 enemy buildings", pt: "Destrua 5 predios inimigos" });
        pool.push({ type: "destroy_enemy", target: 10, rarity: "uncommon", en: "Destroy 10 enemy buildings", pt: "Destrua 10 predios inimigos" });
        pool.push({ type: "destroy_enemy", target: 20, rarity: "common", en: "Destroy 20 enemy buildings", pt: "Destrua 20 predios inimigos" });
        pool.push({ type: "destroy_enemy", target: 60, rarity: "rare", en: "Destroy 60 enemy buildings", pt: "Destrua 60 predios inimigos" });
        pool.push({ type: "units_built", target: 5, rarity: "common", en: "Produce 5 units", pt: "Produza 5 unidades" });
        pool.push({ type: "units_built", target: 10, rarity: "uncommon", en: "Produce 10 units", pt: "Produza 10 unidades" });
        pool.push({ type: "units_built", target: 30, rarity: "epic", en: "Produce 30 units", pt: "Produza 30 unidades" });
        pool.push({ type: "build_any", target: 15, rarity: "common", en: "Build 15 blocks", pt: "Construa 15 blocos" });
    }
    if(mode === "survival" || mode === "campaign"){
        pool.push({ type: "wave", target: 5, rarity: "common", en: "Survive 5 waves", pt: "Sobreviva a 5 waves" });
        pool.push({ type: "wave", target: 15, rarity: "epic", en: "Survive 15 waves", pt: "Sobreviva a 15 waves" });
        pool.push({ type: "destroy_enemy", target: 40, rarity: "uncommon", en: "Destroy 40 enemy buildings", pt: "Destrua 40 prédios inimigos" });
        pool.push({ type: "units_built", target: 8, rarity: "uncommon", en: "Produce 8 units", pt: "Produza 8 unidades" });
    }
    if(mode === "campaign"){
        pool.push({ type: "build_any", target: 120, rarity: "rare", en: "Expand: build 120 blocks", pt: "Expanda: construa 120 blocos" });
        pool.push({ type: "core_items", target: 8000, rarity: "epic", en: "Stockpile 8000 items in cores", pt: "Estoque 8000 itens nos núcleos" });
    }
    if(mode === "sandbox" || mode === "editor"){
        pool.push({ type: "build_any", target: 50, rarity: "common", en: "Sandbox build 50 blocks", pt: "Sandbox: construa 50 blocos" });
        pool.push({ type: "build_any", target: 150, rarity: "rare", en: "Sandbox build 150 blocks", pt: "Sandbox: construa 150 blocos" });
    }
    // Legendary always possible
    pool.push({ type: "build_any", target: 400, rarity: "legendary", en: "Build 400 blocks", pt: "Construa 400 blocos" });
    pool.push({ type: "destroy_enemy", target: 150, rarity: "legendary", en: "Destroy 150 enemy buildings", pt: "Destrua 150 prédios inimigos" });
    return pool;
}

function globalShopStoreKey(){
    // Shared by ALL teams in this save/campaign
    try{
        if(isCampaign()) return "newtechs-shop-shared-campaign-" + safePart(campaignIdentity());
        return "newtechs-shop-shared-save-" + safePart(saveSessionId());
    }catch(e){ return "newtechs-shop-shared-default"; }
}

function loadGlobalShop(){
    try{
        var raw = Core.settings.getString(globalShopStoreKey(), "");
        if(raw != null && (""+raw).length > 2){
            var data = JSON.parse(""+raw);
            if(data != null) return data;
        }
    }catch(e){}
    try{
        if(Vars.state != null && Vars.state.rules != null && Vars.state.rules.tags != null){
            var t = Vars.state.rules.tags.get("newtechs-shop-shared");
            if(t != null && (""+t).length > 2) return JSON.parse(""+t);
        }
    }catch(e2){}
    return null;
}

function saveGlobalShop(shopData){
    try{
        var s = JSON.stringify(shopData);
        Core.settings.put(globalShopStoreKey(), s);
        if(Vars.state != null && Vars.state.rules != null && Vars.state.rules.tags != null){
            Vars.state.rules.tags.put("newtechs-shop-shared", s);
        }
    }catch(e){}
}


function loadFavorites(){
    try{
        var s = Core.settings.getString(FAVORITES_KEY, "{}");
        favoriteBlocks = JSON.parse(s);
        if(favoriteBlocks == null || typeof favoriteBlocks !== "object") favoriteBlocks = {};
    }catch(e){ favoriteBlocks = {}; }
}
function saveFavorites(){
    try{ Core.settings.put(FAVORITES_KEY, JSON.stringify(favoriteBlocks)); }catch(e){}
}
function isFavoriteBlock(name){
    try{ return favoriteBlocks[""+name] === true; }catch(e){ return false; }
}
function toggleFavoriteBlock(name){
    name = ""+name;
    if(favoriteBlocks[name]) delete favoriteBlocks[name];
    else favoriteBlocks[name] = true;
    saveFavorites();
}

var lastQuietInfoAt = 0;
var lastQuietInfoMsg = "";
function quietInfo(msg){
    try{
        var now = nowMs();
        // Avoid stacking dialogs: skip if same msg within 2.5s or any popup within 0.8s
        if(msg === lastQuietInfoMsg && now - lastQuietInfoAt < 2500) return;
        if(now - lastQuietInfoAt < 800) return;
        lastQuietInfoAt = now;
        lastQuietInfoMsg = msg;
        Vars.ui.showInfoToast(msg, 2.5);
    }catch(e){
        try{ Vars.ui.showInfo(msg); }catch(e2){}
    }
}
function tryGrantDailyBonus(){
    try{
        if(Vars.state == null || !Vars.state.isGame()) return;
        var day = (new Date()).toISOString().substring(0, 10);
        var mode = currentGameModeKey();
        var key;
        if(isCampaign()) key = DAILY_BONUS_KEY + "-campaign-" + day;
        else key = DAILY_BONUS_KEY + "-" + safePart(saveSessionId()) + "-" + day;
        if(Core.settings.getBool(key, false)) return;
        var bonus = 150;
        if(mode === "pvp") bonus = 200;
        if(mode === "sandbox") bonus = 100;
        if(mode === "campaign") bonus = 250;
        addPoints(bonus);
        Core.settings.put(key, true);
        try{ quietInfo(tr("Daily bonus: +" + bonus + " points!", "Bonus diario: +" + bonus + " pontos!")); }catch(eI){}
    }catch(e){}
}

function flashInstallEffect(build){
    try{
        if(build == null || Vars.headless) return;
        installFlashBuilds.push({ x: build.x, y: build.y, size: build.block != null ? build.block.size : 1, life: 45 });
        try{ if(typeof Sounds !== "undefined" && Sounds.message != null) Sounds.message.at(build.x, build.y); }catch(eS){}
    }catch(e){}
}

function countResearchedForGroup(group){
    if(group == null || group.upgrades == null) return 0;
    var n = 0;
    for(var i = 0; i < group.upgrades.length; i++){
        if(levelOf(group.upgrades[i]) > 0) n++;
    }
    return n;
}
function ensureComboMastery(group){
    if(group == null || group.block == null) return;
    var block = group.block();
    if(block == null) return;
    var n = countResearchedForGroup(group);
    if(n < 3) return;
    var id = "combo-" + safePart(block.name);
    if(UPGRADES[id] == null){
        UPGRADES[id] = {
            id: id,
            block: function(){ return block; },
            maxLevel: 1,
            max: 1,
            cost: function(lv){ return [[Items.copper, 200],[Items.lead, 150],[Items.silicon, 80]]; },
            nameEn: block.localizedName + " Mastery",
            namePt: "Maestria " + block.localizedName,
            descEn: "Combo: researched 3+ upgrades. +8% efficiency when installed.",
            descPt: "Combo: pesquisou 3+ upgrades. +8% eficiencia ao instalar.",
            name: function(){ return tr(this.nameEn, this.namePt); },
            desc: function(lv){ return tr(this.descEn, this.descPt); },
            keys: block.name + " combo mastery set",
            boost: 0.08,
            installable: true,
            isCombo: true
        };
        if(group.upgrades.indexOf(id) < 0) group.upgrades.push(id);
    }
    if(levelOf(id) <= 0){
        persistentLevels[id] = 1;
        try{ savePersistentState(true); }catch(e2){}
        try{ quietInfo(tr("Combo unlocked: " + block.localizedName + " Mastery!", "Combo desbloqueado: Maestria " + block.localizedName + "!")); }catch(e3){}
    }
}

function ensurePointSystems(){
    ensurePersistentState();
    try{ loadFavorites(); }catch(eF){}
    if(persistentPointMissions == null || !persistentPointMissions.list || persistentPointMissions.mode !== currentGameModeKey()
        || (persistentPointMissions.list.length|0) < 13){
        rollPointMissions();
    }
    var g = loadGlobalShop();
    if(g == null || g.itemSlots == null || g.unitSlots == null){
        rollShopSlots("item", false);
        rollShopSlots("unit", false);
        g = loadGlobalShop();
    }
    persistentShop = g;
    try{
        if(g != null && g.nextRefresh != null && Time.millis() > g.nextRefresh){
            rollShopSlots("item", false);
            rollShopSlots("unit", false);
        }
    }catch(e){}
    try{ tryGrantDailyBonus(); }catch(eD){}
    try{ ensureContracts(); }catch(eCt){}
    try{ loadSpecialization(); }catch(eSp){}
}

function rollPointMissions(){
    var pool = modeMissionPool();
    var list = [];
    var tries = 0;
    var mode = currentGameModeKey();
    while(list.length < 13 && tries < 120){
        tries++;
        var rarity = rollRarity();
        var sub = [];
        for(var i = 0; i < pool.length; i++){
            if(pool[i].rarity === rarity) sub.push(pool[i]);
        }
        if(sub.length === 0) sub = pool;
        var tmpl = sub[(Math.random()*sub.length)|0];
        var reward = rarityPointsReward(tmpl.rarity);
        if(tmpl.target >= 200) reward = Math.min(2000, reward + 400);
        if(tmpl.target >= 100) reward = Math.min(2000, reward + 150);
        if(mode === "pvp" && tmpl.type === "destroy_enemy") reward = Math.min(2000, reward + 100);
        list.push({
            id: "pm-" + Time.millis() + "-" + list.length + "-" + ((Math.random()*9999)|0),
            type: tmpl.type,
            target: tmpl.target,
            progress: 0,
            rarity: tmpl.rarity,
            reward: reward,
            en: tmpl.en,
            pt: tmpl.pt,
            claimed: false,
            mode: mode
        });
    }
    persistentPointMissions = { list: list, mode: mode };
    try{ savePersistentState(false); }catch(e){}
}

function bumpPointMission(type, amount){
    try{ bumpContract(type, amount); }catch(eC){}
    try{ ensurePersistentState(); }catch(eE){}
    if(persistentPointMissions == null || persistentPointMissions.list == null) return;
    amount = amount || 1;
    var list = persistentPointMissions.list;
    var changed = false;
    for(var i = 0; i < list.length; i++){
        var m = list[i];
        if(m == null || m.claimed || m.type !== type) continue;
        m.progress = (m.progress|0) + amount;
        if(m.progress > m.target) m.progress = m.target;
        changed = true;
    }
    if(changed) try{ savePersistentState(false); }catch(e){}
}

function claimPointMission(id){
    if(persistentPointMissions == null || persistentPointMissions.list == null) return false;
    for(var i = 0; i < persistentPointMissions.list.length; i++){
        var m = persistentPointMissions.list[i];
        if(m == null || m.id !== id) continue;
        if(m.claimed) return false;
        if((m.progress|0) < (m.target|0)) return false;
        m.claimed = true;
        addPoints(m.reward|0);
        return true;
    }
    return false;
}

function unitFixedRarity(u){
    // Fixed rarity by unit power/tier — does not change on shop refresh
    var cost = unitTierCost(u);
    if(cost >= 10000) return "legendary";
    if(cost >= 4500) return "epic";
    if(cost >= 1500) return "rare";
    if(cost >= 350) return "uncommon";
    return "common";
}

function pickAnyShopUnit(){
    try{
        var pool = [];
        Vars.content.units().each(function(u){
            if(u == null || u.isHidden()) return;
            try{ if(u.isBanned && u.isBanned()) return; }catch(e){}
            // skip huge bosses if needed — still allow T5
            pool.push(u);
        });
        if(pool.length === 0) return null;
        return pool[(Math.random()*pool.length)|0];
    }catch(e){ return null; }
}

function unitTierCost(u){
    if(u == null) return 500;
    var h = 0;
    try{ h = u.health|0; }catch(e){}
    var n = (""+u.name).toLowerCase();
    if(n.indexOf("conquer") >= 0 || n.indexOf("omura") >= 0 || n.indexOf("reign") >= 0 || n.indexOf("toxopid") >= 0) return 12000;
    if(n.indexOf("crawler") >= 0) return 100;
    if(n.indexOf("nova") >= 0 || n.indexOf("dagger") >= 0 || n.indexOf("flare") >= 0) return 250;
    if(h >= 10000) return 12000;
    if(h >= 6000) return 8000;
    if(h >= 3500) return 4500;
    if(h >= 1500) return 1800;
    if(h >= 600) return 700;
    if(h >= 250) return 350;
    return 150;
}

function itemShopCost(item, rarity){
    // Cheaper resources overall
    var base = 35;
    if(rarity === "uncommon") base = 70;
    if(rarity === "rare") base = 140;
    if(rarity === "epic") base = 280;
    if(rarity === "legendary") base = 550;
    try{
        var n = (""+item.name).toLowerCase();
        if(n === "surge-alloy" || n === "phase-fabric" || n === "carbide") base = Math.max(base, 320);
        if(n === "thorium" || n === "titanium" || n === "tungsten") base = Math.max(base, 100);
        if(n === "copper" || n === "lead" || n === "sand" || n === "coal" || n === "scrap") base = Math.min(base, 40);
    }catch(e){}
    return base;
}

function itemOnCurrentPlanet(it){
    if(it == null) return false;
    var p = null;
    try{ p = currentPlanetObject(); }catch(e){}
    // No planet / sun / custom => all items
    if(p == null || isSunPlanet(p)) return true;
    try{
        var pn = ("" + p.name).toLowerCase();
        if(pn === "" || pn === "custom") return true;
    }catch(e0){}
    try{
        var planets = it.shownPlanets;
        if(planets == null || planets.size <= 0){
            // Fallback by known names when shownPlanets empty
            var n = (""+it.name).toLowerCase();
            var pn2 = (""+p.name).toLowerCase();
            if(pn2.indexOf("erekir") >= 0){
                if(n === "copper" || n === "lead" || n === "titanium" || n === "thorium" || n === "plastanium" || n === "phase-fabric" || n === "metaglass" || n === "spore-pod" || n === "pyratite" || n === "blast-compound") return false;
            }
            if(pn2.indexOf("serpulo") >= 0){
                if(n === "beryllium" || n === "tungsten" || n === "oxide" || n === "carbide" || n === "fissile-matter" || n === "dormant-cyst") return false;
            }
            return true;
        }
        if(planets.contains(p)) return true;
        try{
            var it2 = planets.iterator();
            while(it2.hasNext()){
                var sp = it2.next();
                if(isSunPlanet(sp)) return true;
            }
        }catch(eIt){}
        return false;
    }catch(e){}
    return true;
}

function defaultStock(rarity, kind){
    if(kind === "unit"){
        // Units: higher stock so they don't sell out instantly
        if(rarity === "legendary") return 2 + ((Math.random()*2)|0);      // 2-3
        if(rarity === "epic") return 4 + ((Math.random()*3)|0);           // 4-6
        if(rarity === "rare") return 6 + ((Math.random()*4)|0);            // 6-9
        if(rarity === "uncommon") return 8 + ((Math.random()*5)|0);        // 8-12
        return 10 + ((Math.random()*6)|0);                                 // 10-15 common
    }
    // Items/resources: low stock
    if(rarity === "legendary") return 1;
    if(rarity === "epic") return 1 + ((Math.random()*1)|0);               // 1-1
    if(rarity === "rare") return 1 + ((Math.random()*2)|0);               // 1-2
    if(rarity === "uncommon") return 2 + ((Math.random()*2)|0);           // 2-3
    return 2 + ((Math.random()*2)|0);                                     // 2-3 common
}

function rollShopSlots(kind, paid){
    // kind: "item" | "unit" — up to 10 slots, some may be empty
    var g = loadGlobalShop();
    if(g == null) g = { itemSlots: [], unitSlots: [], nextRefresh: Time.millis() + 20*60*1000, rolledAt: Time.millis() };

    var slots = [];
    var count = 6 + ((Math.random()*5)|0); // 6-10 filled
    if(count > 10) count = 10;
    var usedNames = {};
    for(var i = 0; i < 10; i++){
        if(i >= count){
            slots.push(null); // empty slot
            continue;
        }
        if(kind === "unit"){
            // Units: no planet filter, but NO duplicates
            var unit = pickShopUnitUnique(usedNames);
            if(unit == null){ slots.push(null); continue; }
            usedNames[""+unit.name] = true;
            var rarity = unitFixedRarity(unit);
            var ust = defaultStock(rarity, "unit");
            slots.push({
                kind: "unit",
                name: ""+unit.name,
                rarity: rarity,
                cost: unitTierCost(unit),
                stock: ust,
                maxStock: ust,
                promo: false
            });
        }else{
            // Items: planet filter + NO duplicates
            var rarity = rollRarity();
            var item = pickShopItem(rarity, usedNames);
            if(item == null){ slots.push(null); continue; }
            usedNames[""+item.name] = true;
            var amt = rarity === "legendary" ? 30 : (rarity === "epic" ? 50 : (rarity === "rare" ? 70 : 100));
            var st = defaultStock(rarity, "item");
            var cost = itemShopCost(item, rarity);
            // ~30% chance of promotion (discount)
            var promo = Math.random() < 0.30;
            var promoMult = 1;
            if(promo){
                promoMult = 0.45 + Math.random() * 0.25; // 45–70% of price
                cost = Math.max(5, Math.floor(cost * promoMult));
            }
            slots.push({
                kind: "item",
                name: ""+item.name,
                amount: amt,
                rarity: rarity,
                cost: cost,
                stock: st,
                maxStock: st,
                promo: promo,
                promoMult: promo ? promoMult : 1
            });
        }
    }
    if(kind === "unit") g.unitSlots = slots;
    else g.itemSlots = slots;
    try{
        var best = -1, bestScore = -1;
        for(var fi = 0; fi < slots.length; fi++){
            var fs = slots[fi];
            if(fs == null) continue;
            var score = (fs.promo ? 5 : 0) + (fs.rarity === "legendary" ? 4 : fs.rarity === "epic" ? 3 : fs.rarity === "rare" ? 2 : 1) + Math.random();
            if(score > bestScore){ bestScore = score; best = fi; }
        }
        if(kind === "item") g.featuredItem = best; else g.featuredUnit = best;
        if(best >= 0 && slots[best] != null && !slots[best].promo){
            slots[best].promo = true;
            slots[best].cost = Math.max(10, Math.floor((slots[best].cost|0) * 0.55));
        }
    }catch(eF){}
    g.nextRefresh = nowMs() + 20 * 60 * 1000;
    g.rolledAt = Time.millis();
    saveGlobalShop(g);
    persistentShop = g;
}

function pickShopItem(rarity, usedNames){
    try{
        var pool = [];
        Vars.content.items().each(function(it){
            if(it == null || it.isHidden()) return;
            try{ if(!itemOnCurrentPlanet(it)) return; }catch(eP){}
            try{
                if(usedNames != null && usedNames[""+it.name]) return;
            }catch(eU){}
            var hard = 0;
            try{ hard = it.hardness|0; }catch(e){}
            if(rarity === "common" && hard > 1) return;
            if(rarity === "uncommon" && hard > 2) return;
            if(rarity === "legendary" && hard < 2) return;
            pool.push(it);
        });
        if(pool.length === 0){
            // Relax rarity hardness if planet filter emptied pool
            Vars.content.items().each(function(it){
                if(it == null || it.isHidden()) return;
                try{ if(!itemOnCurrentPlanet(it)) return; }catch(eP2){}
                try{ if(usedNames != null && usedNames[""+it.name]) return; }catch(eU2){}
                pool.push(it);
            });
        }
        if(pool.length === 0) return null;
        return pool[(Math.random()*pool.length)|0];
    }catch(e){ return null; }
}

function pickShopUnitUnique(usedNames){
    try{
        var pool = [];
        Vars.content.units().each(function(u){
            if(u == null || u.isHidden()) return;
            try{ if(u.isBanned && u.isBanned()) return; }catch(e){}
            try{ if(usedNames != null && usedNames[""+u.name]) return; }catch(eU){}
            pool.push(u);
        });
        if(pool.length === 0) return null;
        return pool[(Math.random()*pool.length)|0];
    }catch(e){ return null; }
}

function pickShopUnit(rarity){
    try{
        var pool = [];
        Vars.content.units().each(function(u){
            if(u == null || u.isHidden()) return;
            try{ if(u.isBanned && u.isBanned()) return; }catch(e){}
            var cost = unitTierCost(u);
            if(rarity === "common" && cost > 400) return;
            if(rarity === "uncommon" && (cost < 200 || cost > 1200)) return;
            if(rarity === "rare" && (cost < 600 || cost > 5000)) return;
            if(rarity === "epic" && (cost < 2000 || cost > 9000)) return;
            if(rarity === "legendary" && cost < 5000) return;
            pool.push(u);
        });
        if(pool.length === 0) return null;
        return pool[(Math.random()*pool.length)|0];
    }catch(e){ return null; }
}


function giveItemsToPlayerTeam(item, amount){
    if(item == null || amount <= 0) return false;
    try{
        if(Vars.player == null) return false;
        var team = Vars.player.team();
        // Prefer player closest core
        var core = null;
        try{ core = Vars.player.core(); }catch(e0){}
        if(core == null && team != null){
            try{ core = team.core(); }catch(e1){}
        }
        if(core != null && core.items != null){
            try{ core.items.add(item, amount); return true; }catch(e2){}
            try{ core.handleStack(item, amount, Vars.player.unit()); return true; }catch(e3){}
        }
        // All team cores
        var cores = researchCores();
        for(var i = 0; i < cores.length; i++){
            var c = cores[i];
            if(c == null || c.items == null) continue;
            try{ c.items.add(item, amount); return true; }catch(e4){}
            try{ c.handleStack(item, amount, null); return true; }catch(e5){}
        }
        // Team item pool (some versions)
        try{
            if(team != null && team.items != null){
                team.items.add(item, amount);
                return true;
            }
        }catch(e6){}
    }catch(e){ Log.err("New Tech's giveItems: " + e); }
    return false;
}

function buyShopSlot(kind, index){
    ensurePointSystems();
    var g = loadGlobalShop();
    if(g == null) return false;
    var slots = kind === "unit" ? g.unitSlots : g.itemSlots;
    if(slots == null) return false;
    var slot = slots[index];
    if(slot == null) return false;
    if((slot.stock|0) <= 0){
        quietInfo(tr("Out of stock.", "Fora de estoque."));
        return false;
    }
    var cost = slot.cost|0;
    if(!spendPoints(cost)){
        quietInfo(tr("Not enough points.", "Pontos insuficientes."));
        return false;
    }

    // Clients cannot spawn units / add core items — host must fulfill
    try{
        if(shopUsesHostRelay()){
            var payload = JSON.stringify({
                op: "buy",
                kind: kind === "unit" ? "unit" : "item",
                index: index|0,
                name: slot.name,
                amount: slot.amount|0,
                cost: cost
            });
            Call.serverPacketReliable("newtechs-shop", payload);
            slot.stock = Math.max(0, (slot.stock|0) - 1);
            return true;
        }
    }catch(eNet){}

    // Host / singleplayer
    if(slot.kind === "item"){
        var item = Vars.content.item(slot.name);
        if(item == null){ addPoints(cost); return false; }
        var amt = slot.amount|0;
        if(amt <= 0) amt = 1;
        if(!giveItemsToPlayerTeam(item, amt)){
            addPoints(cost);
            Vars.ui.showInfo(tr("No core to receive items.", "Sem nucleo para receber itens."));
            return false;
        }
    }else if(slot.kind === "unit"){
        var ut = Vars.content.unit(slot.name);
        if(ut == null){ addPoints(cost); return false; }
        var ok = spawnUnitSafely(ut);
        if(!ok){ addPoints(cost); Vars.ui.showInfo(tr("Could not find a safe spawn near you.", "Nao foi possivel achar spawn seguro.")); return false; }
    }else{
        addPoints(cost);
        return false;
    }
    slot.stock = Math.max(0, (slot.stock|0) - 1);
    saveGlobalShop(g);
    persistentShop = g;
    return true;
}

function spawnUnitSafely(unitType){
    try{
        if(Vars.player == null || unitType == null) return false;
        var team = Vars.player.team();
        if(team == null) return false;
        var px = Vars.player.x;
        var py = Vars.player.y;
        var bestX = px, bestY = py;
        var best = null;
        var bestScore = -1e9;
        for(var r = 0; r <= 20; r++){
            for(var dx = -r; dx <= r; dx++){
                for(var dy = -r; dy <= r; dy++){
                    if(r > 0 && Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                    var tx = (px / 8 + dx)|0;
                    var ty = (py / 8 + dy)|0;
                    var tile = Vars.world.tile(tx, ty);
                    if(tile == null) continue;
                    try{ if(tile.solid()) continue; }catch(eSol){}
                    try{ if(tile.floor() != null && tile.floor().isDeep()) continue; }catch(eD){}
                    var score = 100 - (Math.abs(dx)+Math.abs(dy));
                    try{
                        if(tile.build != null && tile.build.team === team) score += 30;
                        if(tile.floor() != null && tile.floor().isLiquid) score -= 40;
                    }catch(eS){}
                    if(score > bestScore){
                        bestScore = score;
                        best = tile;
                        bestX = tile.worldx();
                        bestY = tile.worldy();
                    }
                }
            }
            if(best != null && bestScore >= 90) break;
        }
        if(best == null){
            try{
                var core = team.core();
                if(core != null){ bestX = core.x; bestY = core.y; }
            }catch(eC){}
        }
        // Try several spawn APIs (version differences)
        var unit = null;
        try{ unit = unitType.spawn(team, bestX, bestY); }catch(e1){}
        if(unit == null){
            try{
                unit = unitType.create(team);
                if(unit != null){
                    unit.set(bestX, bestY);
                    unit.add();
                }
            }catch(e2){}
        }
        if(unit == null){
            try{
                unit = unitType.create(team);
                if(unit != null){
                    unit.x = bestX; unit.y = bestY;
                    unit.add();
                }
            }catch(e3){}
        }
        if(unit == null){
            try{
                // Core spawn as last resort
                var c2 = team.core();
                if(c2 != null) unit = unitType.spawn(team, c2.x, c2.y);
            }catch(e4){}
        }
        return unit != null;
    }catch(e){
        Log.err("New Tech's unit spawn: " + e);
        return false;
    }
}

function shopRefreshCost(g){
    // Closer to auto-refresh = cheaper (1200 full → 100 near refresh)
    try{
        var now = nowMs();
        var next = g != null ? Number(g.nextRefresh) : 0;
        var full = 20 * 60 * 1000;
        if(!isFinite(next) || next <= 0) return 1200;
        var left = Math.max(0, next - now);
        var frac = Math.min(1, left / full);
        // At start of cycle: ~1200; near end: ~100
        return Math.max(100, Math.min(1200, Math.floor(100 + frac * 1100)));
    }catch(e){ return 1200; }
}
function showPointMissionsDialog(){
    ensurePointSystems();
    var dialog = new BaseDialog(tr("Point Missions", "Missões de Pontos"));
    var body = new Table();
    body.defaults().growX().pad(4);
    var mode = currentGameModeKey();
    body.add("[accent]" + tr("Points: ", "Pontos: ") + (persistentPoints|0)).row();
    body.add("[lightgray]" + tr("Mode: ", "Modo: ") + mode.toUpperCase() + " — " + tr("missions adapt to this mode", "missões adaptadas a este modo")).wrap().row();
    body.add("[gray]" + tr("Harder missions pay more (100–2000).", "Missões mais difíceis pagam mais (100–2000).")).wrap().row();

    var list = (persistentPointMissions && persistentPointMissions.list) ? persistentPointMissions.list : [];
    for(var i = 0; i < list.length; i++){
        (function(m){
            var frac = m.target > 0 ? Math.min(1, (m.progress|0) / (m.target|0)) : 0;
            var col = RARITY_COLOR[m.rarity] || "[white]";
            body.table(Tex.pane, function(tbl){
                tbl.left().defaults().left().pad(3);
                tbl.add(col + (m.rarity || "").toUpperCase() + "[] — " + tr(m.en, m.pt)).growX().wrap().row();
                tbl.add(progressBarText(frac, (m.progress|0) >= (m.target|0)) + " [lightgray]" + (m.progress|0) + "/" + (m.target|0)).row();
                tbl.add("[#ffd54f]" + tr("Reward: ", "Recompensa: ") + (m.reward|0) + " " + tr("pts", "pts")).row();
                if(m.claimed){
                    tbl.add("[lime]" + tr("Claimed", "Resgatado")).row();
                }else{
                    tbl.button(tr("Claim", "Resgatar"), function(){
                        if(claimPointMission(m.id)){
                            dialog.hide();
                            showPointMissionsDialog();
                        }else{
                            Vars.ui.showInfo(tr("Mission not complete yet.", "Missão ainda incompleta."));
                        }
                    }).disabled((m.progress|0) < (m.target|0)).size(120, 40).padTop(2);
                }
            }).growX().row();
        })(list[i]);
    }
    body.button(tr("Reroll missions (when all claimed)", "Sortear missões (quando todas resgatadas)"), function(){
        var allClaimed = true;
        for(var j = 0; j < list.length; j++) if(list[j] && !list[j].claimed) allClaimed = false;
        if(!allClaimed && list.length > 0){
            Vars.ui.showInfo(tr("Finish or claim current missions first.", "Termine ou resgate as missões atuais primeiro."));
            return;
        }
        rollPointMissions();
        dialog.hide();
        showPointMissionsDialog();
    }).size(Vars.mobile ? 280 : 300, 42).padTop(6).row();

    dialog.addCloseButton();
    dialog.cont.pane(body).grow().pad(8);
    dialog.show();
}

function showPointShopDialog(kind){
    if(kind !== "unit") kind = "item";
    ensurePointSystems();
    var title = kind === "unit"
        ? tr("Unit Shop", "Loja de Unidades")
        : tr("Item Shop", "Loja de Recursos");
    var dialog = new BaseDialog(title);
    var body = new Table();
    body.defaults().growX().pad(4);
    body.add("[accent]" + tr("Points: ", "Pontos: ") + (persistentPoints|0)).row();
    body.add("[gray]" + tr("Shared stock • 10 slots • 20 min refresh • multiplayer OK", "Estoque compartilhado • 10 slots • troca 20 min • multiplayer OK")).wrap().row();
    try{
        var mode = currentGameModeKey();
        if(isWorldAuthority()){
            body.add("[#81c784]" + tr("Mode: " + mode + " — instant buy (host/offline).", "Modo: " + mode + " — compra instantanea (host/offline).")).wrap().padBottom(2).row();
        }else if(modeAllowsFreeShopUi()){
            body.add("[#81c784]" + tr("Mode: " + mode + " — buy to host, no extra confirm.", "Modo: " + mode + " — compra no host, sem confirm extra.")).wrap().padBottom(2).row();
        }else{
            body.add("[#81c784]" + tr("Multiplayer: host delivers to your core / near you.", "Multiplayer: host entrega no nucleo / perto de voce.")).wrap().padBottom(2).row();
        }
    }catch(eM){}

    var g = loadGlobalShop();
    try{
        var featIdx = kind === "unit" ? g.featuredUnit : g.featuredItem;
        var slotsF = kind === "unit" ? g.unitSlots : g.itemSlots;
        if(featIdx != null && featIdx >= 0 && slotsF != null && slotsF[featIdx] != null){
            var fs = slotsF[featIdx];
            body.table(Tex.button, function(card){
                card.left().defaults().left().pad(3);
                card.add("[#ffd54f]" + tr("★ FEATURED DEAL", "★ VITRINE DO DIA")).row();
                var nm = fs.name;
                try{
                    if(kind === "unit"){ var u = Vars.content.unit(fs.name); if(u) nm = u.localizedName; }
                    else { var it = Vars.content.item(fs.name); if(it) nm = it.localizedName; }
                }catch(eN){}
                card.add("[accent]" + nm + (fs.promo ? "  [scarlet]PROMO" : "")).row();
                card.add("[#ffd54f]" + (fs.cost|0) + " pts   [lightgray]stock " + (fs.stock|0)).row();
                card.button(tr("Buy featured", "Comprar vitrine"), function(){
                    buyShopSlot(kind, featIdx);
                    dialog.hide();
                    showPointShopDialog(kind);
                }).size(160, 40).padTop(2);
            }).growX().padBottom(6).row();
        }
    }catch(eFeat){}

    var leftMin = 0;
    try{
        if(g != null && g.nextRefresh != null){
            leftMin = Math.max(0, Math.ceil((Number(g.nextRefresh) - nowMs()) / 60000));
        }
    }catch(e){}
    body.add("[lightgray]" + tr("Next auto refresh: ~", "Próxima troca auto: ~") + leftMin + " min").row();

    var refreshCost = shopRefreshCost(g);
    body.add("[gray]" + tr("Reroll is cheaper near auto-refresh.", "Reroll fica mais barato perto da troca auto.")).wrap().row();
    body.button(tr("Refresh shop (", "Atualizar loja (") + refreshCost + " pts)", function(){
        var costNow = shopRefreshCost(loadGlobalShop());
        if(!spendPoints(costNow)){
            quietInfo(tr("Not enough points.", "Pontos insuficientes."));
            return;
        }
        rollShopSlots(kind, true);
        dialog.hide();
        showPointShopDialog(kind);
    }).size(Vars.mobile ? 260 : 280, 42).padBottom(6).row();

    var slots = [];
    if(g != null) slots = kind === "unit" ? (g.unitSlots || []) : (g.itemSlots || []);

    for(var i = 0; i < 10; i++){
        (function(slot, index){
            body.table(Tex.pane, function(tbl){
                tbl.left().defaults().left().pad(3);
                if(slot == null){
                    tbl.add("[gray]" + tr("Empty slot", "Slot vazio")).growX().row();
                    return;
                }
                var col = RARITY_COLOR[slot.rarity] || "[white]";
                var titleLine = "?";
                var iconDrawable = null;
                if(slot.kind === "item"){
                    var it = Vars.content.item(slot.name);
                    titleLine = (it != null ? it.localizedName : slot.name) + " x" + (slot.amount|0);
                    try{ if(it != null && it.uiIcon != null) iconDrawable = it.uiIcon; }catch(eI){}
                }else{
                    var ut = Vars.content.unit(slot.name);
                    titleLine = tr("Unit: ", "Unidade: ") + (ut != null ? ut.localizedName : slot.name);
                    try{ if(ut != null && ut.uiIcon != null) iconDrawable = ut.uiIcon; }catch(eU){}
                }
                tbl.table(Styles.none, function(row){
                    if(iconDrawable != null){
                        try{ row.image(iconDrawable).size(36).padRight(6); }catch(eImg){}
                    }
                    row.add(col + (slot.rarity||"").toUpperCase() + "[] — " + titleLine).growX().wrap();
                }).growX().row();
                var priceLine = "[#ffd54f]" + (slot.cost|0) + " " + tr("pts", "pts");
                if(slot.promo){
                    priceLine += "  [accent]" + tr("SALE!", "PROMOÇÃO!");
                }
                priceLine += "   [lightgray]" + tr("Stock: ", "Estoque: ") + (slot.stock|0) + "/" + (slot.maxStock|0);
                tbl.add(priceLine).row();
                if((slot.stock|0) <= 0){
                    tbl.add("[scarlet]" + tr("OUT OF STOCK", "FORA DE ESTOQUE")).row();
                }else{
                    tbl.button(tr("Buy", "Comprar"), function(){
                        buyShopSlot(kind, index);
                        dialog.hide();
                        showPointShopDialog(kind);
                    }).size(110, 40).padTop(2);
                }
            }).growX().row();
        })(slots[i] || null, i);
    }

    dialog.addCloseButton();
    dialog.cont.pane(body).grow().pad(8);
    dialog.show();
}

// ---- Event hooks for missions ----
Events.on(BlockBuildEndEvent, function(e){
    try{
        if(e == null || e.breaking) return;
        if(Vars.player == null) return;
        if(e.team != null && e.team !== Vars.player.team()) return;
        var block = e.tile != null ? e.tile.block() : null;
        if(block == null && e.tile != null && e.tile.build != null) block = e.tile.build.block;
        if(block == null) return;
        bumpMasterMission("build", ""+block.name, 1);
        bumpPointMission("build_any", 1);
    }catch(err){}
});

Events.on(BlockDestroyEvent, function(e){
    try{
        if(e == null || e.tile == null || e.tile.build == null) return;
        if(Vars.player == null) return;
        if(e.tile.build.team === Vars.player.team()) return;
        bumpPointMission("destroy_enemy", 1);
    }catch(err){}
});

Events.on(UnitCreateEvent, function(e){
    try{
        if(e == null || e.unit == null) return;
        if(Vars.player == null) return;
        if(e.unit.team !== Vars.player.team()) return;
        bumpPointMission("units_built", 1);
    }catch(err){}
});

Events.on(WaveEvent, function(e){
    try{ bumpPointMission("wave", 1); }catch(err){}
});

// Core deposit missions — track real deposits into cores
Events.on(DepositEvent, function(e){
    try{
        if(e == null) return;
        if(Vars.player == null) return;
        var amount = 0;
        try{ amount = e.amount|0; }catch(eA){ amount = 0; }
        if(amount <= 0) return;
        var build = null;
        try{ build = e.tile != null ? e.tile.build : null; }catch(eB){}
        if(build == null) try{ build = e.building; }catch(eB2){}
        if(build == null) return;
        try{ if(build.team !== Vars.player.team()) return; }catch(eT){ return; }
        var isCore = false;
        try{ if(build.block != null && build.block instanceof CoreBlock) isCore = true; }catch(eC){}
        if(!isCore){
            try{
                var bn = (""+build.block.name).toLowerCase();
                if(bn.indexOf("core-") === 0 || bn.indexOf("core") >= 0) isCore = true;
            }catch(eN){}
        }
        if(!isCore) return;
        bumpPointMission("core_items", amount);
    }catch(err){}
});

// Water mission + core deposit tracking (heavily throttled for FPS)
var lastMissionScanTick = 0;
var lastCoreItemsTotal = -1;
var missionScanPhase = 0;

function totalCoreItemsForTeam(){
    var total = 0;
    try{
        var cores = researchCores();
        for(var i = 0; i < cores.length; i++){
            var c = cores[i];
            if(c == null || c.items == null) continue;
            var got = false;
            try{
                if(typeof c.items.total === "function"){
                    total += (c.items.total()|0);
                    got = true;
                }
            }catch(eT0){}
            if(!got){
                try{
                    // ItemModule.total field on some versions
                    var tf = c.items.total;
                    if(typeof tf === "number"){ total += tf|0; got = true; }
                }catch(eT1){}
            }
            if(!got){
                try{
                    c.items.each(function(item, amount){ total += amount|0; });
                    got = true;
                }catch(eEach){}
            }
            if(!got){
                try{
                    // Fallback: sum by content items
                    Vars.content.items().each(function(it){
                        try{ total += c.items.get(it)|0; }catch(eG){}
                    });
                }catch(eF){}
            }
        }
        // Also team item pool if cores empty
        if(total === 0 && Vars.player != null && Vars.player.team() != null){
            try{
                var ti = Vars.player.team().items();
                if(ti != null && typeof ti.total === "function") total = ti.total()|0;
            }catch(eTeam){}
        }
    }catch(e){}
    return total;
}

function anyOpenWaterMission(){
    try{
        var ids = Object.keys(MASTER_UPGRADES);
        for(var i = 0; i < ids.length; i++){
            var u = MASTER_UPGRADES[ids[i]];
            if(u == null || u.mission == null || u.mission.type !== "water") continue;
            if(!isMasterMissionComplete(u.id)) return true;
        }
    }catch(e){}
    return false;
}

Events.run(Trigger.update, function(){
    try{
        if(Vars.state == null || !Vars.state.isGame()) return;
        if(Vars.player == null) return;
        // ~ every 5 seconds only
        if(Time.time - lastMissionScanTick < 90) return;
        lastMissionScanTick = Time.time;
        missionScanPhase = (missionScanPhase + 1) % 2;

        // Phase 0: core items only
        if(missionScanPhase === 0){
            try{
                var total = totalCoreItemsForTeam();
                if(lastCoreItemsTotal >= 0 && total > lastCoreItemsTotal){
                    bumpPointMission("core_items", total - lastCoreItemsTotal);
                }
                lastCoreItemsTotal = total;
            }catch(eCore){}
            return;
        }

        // Phase 1: water master missions (skip entirely if none open)
        if(!anyOpenWaterMission()) return;
        var team = Vars.player.team();
        var px = Vars.player.tileX();
        var py = Vars.player.tileY();
        // Small radius, sparse samples
        for(var dx = -6; dx <= 6; dx += 3){
            for(var dy = -6; dy <= 6; dy += 3){
                var t = Vars.world.tile(px + dx, py + dy);
                if(t == null || t.build == null) continue;
                if(t.build.team !== team) continue;
                try{
                    var liq = t.build.liquids;
                    if(liq != null && liq.get(Liquids.water) > 0.05){
                        bumpMasterMission("water", ""+t.build.block.name, 1);
                    }
                }catch(eW){}
            }
        }
    }catch(err){}
});

Events.on(WorldLoadEvent, function(){
    lastCoreItemsTotal = -1;
    lastMissionScanTick = 0;
});



Events.on(WorldLoadEvent, function(){
    try{
        Timer.schedule(function(){
            try{ ensurePointSystems(); tryGrantDailyBonus(); }catch(e){}
        }, 1.5);
    }catch(e){}
});
