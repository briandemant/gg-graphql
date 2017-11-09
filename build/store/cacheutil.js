"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const { promisify } = require("util");
const fs = require("fs");
const zlib = require("zlib");
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const unzipAsync = promisify(zlib.unzip);
const gzipAsync = promisify(zlib.gzip);
const MAX_AUTO_UPDATES = 10;
const useZip = process.env.ENV !== "develop";
function hasUsername(item) {
    return item.item.username !== undefined;
}
function to_human_debug(item) {
    if (hasUsername(item)) {
        return item.item.username;
    }
    else {
        return item.item.title;
    }
}
function loadFromDisk(name) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let cacheRoot;
            if (useZip) {
                const gzipped = yield readFileAsync(`./data/${name}.json.gz`);
                const buffer = yield unzipAsync(new Buffer(gzipped));
                cacheRoot = JSON.parse(buffer.toString());
                cacheRoot.hasChanged = false;
            }
            else {
                const raw = yield readFileAsync(`./data/${name}.json`);
                cacheRoot = JSON.parse(raw);
                cacheRoot.hasChanged = false;
            }
            console.log(`loaded ${name} cache it was ${Date.now() - cacheRoot.saved} seconds old`);
            return cacheRoot;
        }
        catch (e) {
            return { name, saved: 0, hasChanged: false, byId: {}, memoize: {} };
        }
    });
}
function saveToDisk(name, cache) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!process.env.NOW) {
            cache.saved = Date.now();
            delete cache.hasChanged;
            yield writeFileAsync(`./data/${name}.json`, JSON.stringify(cache, null, 2));
            const gzipped = yield gzipAsync(JSON.stringify(cache));
            yield writeFileAsync(`./data/${name}.json.gz`, gzipped);
            cache.hasChanged = false;
            // console.log(`\n\nsaved ${name} cache\n\n`)
        }
    });
}
function waitWithJitter(waitInSeconds) {
    return addJitter(waitInSeconds) * 1000;
}
function addJitter(waitInSeconds) {
    return waitInSeconds * (0.8 + 0.3 * Math.random()) | 0;
}
function errOut(err) {
    console.error(err);
}
class CacheUtil {
    constructor(name, refreshItemFn, refreshItemRateInSeconds) {
        this.name = name;
        this.refreshItemFn = refreshItemFn;
        this.refreshItemRateInSeconds = refreshItemRateInSeconds;
        this.runningPromises = {};
        this.updateQueue = [];
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            this.cache = yield loadFromDisk(this.name);
            this.cache.name = this.name;
            setTimeout(() => {
                this.autoRefreshItems().catch(errOut);
                this.saveCache().catch(errOut);
                this.updateOrClearMemoize().catch(errOut);
                this.processUpdateQueue().catch(errOut);
            }, 1000);
        });
    }
    getAgeInSeconds(id) {
        const item = this.cache.byId[id];
        return item ? (Date.now() - item.ts) / 1000 | 0 : Infinity;
    }
    get(id, scheduleUpdate = true) {
        return __awaiter(this, void 0, void 0, function* () {
            const cached = this.cache.byId[id];
            if (typeof cached !== "undefined") {
                if (scheduleUpdate) {
                    this.scheduleUpdate(id);
                }
                return cached.item;
            }
            return this.refreshItemFn(id, Infinity).then((item) => item ? this.update(item) : item);
        });
    }
    remove(id) {
        delete this.cache.byId[id];
        this.cache.hasChanged = true;
    }
    all(limit = 0) {
        const all = Object.keys(this.cache.byId).map(id => this.cache.byId[id].item);
        return limit === 0 ? all : all.slice(0, limit);
    }
    scheduleUpdate(id, priority = "high") {
        // add to start of queue (high pri)
        // console.log("scheduleUpdate", this.name, id, this.getAgeInSeconds(id))
        if (priority === "high") {
            var item = this.cache.byId[id];
            let ageInSeconds = this.getAgeInSeconds(id);
            console.log("updating", this.name, id, to_human_debug(item), ((ageInSeconds / 60 | 0) / 60 * 100 | 0) / 100 + "h");
            this.updateQueue.unshift(id);
        }
        else {
            this.updateQueue.push(id);
        }
    }
    update(item) {
        this.cache.hasChanged = true;
        this.cache.byId[item.id] = {
            ts: Date.now(),
            item,
        };
        return item;
    }
    memoize(name, params, options, fn) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `${name}::${JSON.stringify(params)}`;
            this.cache.memoize = this.cache.memoize || {};
            let result = this.cache.memoize[key];
            if (result && Date.now() < result.ts + options.ttl * 1000) {
                // console.log("ttl ok")
                return result.value;
            }
            console.log("FETCHING", name, params);
            this.runningPromises[key] = this.runningPromises[key] || fn(params).then((value) => {
                delete this.runningPromises[key];
                console.log("REFRESHING CACHE .. done");
                this.cache.memoize[key] = {
                    ts: Date.now(),
                    name: name,
                    params: params,
                    options: options,
                    fn: fn,
                    value: value,
                };
                return value;
            });
            if (result && options.stale && Date.now() < result.ts + options.stale * 1000) {
                console.log("stale ok");
                return result.value;
            }
            else {
                // console.log("need update")
                return this.runningPromises[key];
            }
        });
    }
    saveCache() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!process.env.NOW) {
                if (this.cache.hasChanged) {
                    // console.log(`saveCache ${ this.name}`)
                    yield saveToDisk(this.name, this.cache).catch(errOut);
                }
                setTimeout(() => this.saveCache().catch(errOut), waitWithJitter(30));
            }
        });
    }
    autoRefreshItems() {
        return __awaiter(this, void 0, void 0, function* () {
            // console.log(`autoRefreshItems ${ this.name}`)
            for (let item of this.all()) {
                // console.log(this.name, "item.id", item.id, this.getAgeInSeconds(item.id))
                if (typeof item.id === "undefined") {
                    delete this.cache.byId[item.id];
                }
                else if (this.isItemStale(item.id)) {
                    // add to end of queue (low pri)
                    this.scheduleUpdate(item.id, "low");
                }
            }
            let between = (value, min, max) => Math.min(max, Math.max(min, value));
            let sleep = waitWithJitter(between(this.refreshItemRateInSeconds / 60, 60, 60 * 60));
            // console.log("SLEEP ", sleep, this.name)
            setTimeout(() => {
                this.autoRefreshItems().catch(errOut);
            }, sleep);
        });
    }
    processUpdateQueue() {
        return __awaiter(this, void 0, void 0, function* () {
            const BATCH_TIME = 5 * 1000;
            // if (this.name != "category") {
            // 	return
            // }
            // console.log("START processUpdateQueue")
            let processQueue = lodash_1.uniq(this.updateQueue);
            if (processQueue.length > 0) {
                // console.log("processUpdateQueue", this.name, processQueue.length)
                const started = Date.now();
                let processed = [];
                for (const id of processQueue) {
                    let ageInSeconds = this.getAgeInSeconds(id);
                    const item = this.cache.byId[id] ? this.cache.byId[id] : id;
                    if (typeof item === "undefined") {
                        delete this.cache.byId[id];
                        continue;
                    }
                    // console.log("updating",
                    // 	this.name, id, to_human_debug(item), ((ageInSeconds / 60 | 0) / 60 * 100 | 0) / 100 + "h")
                    const updated = yield this.refreshItemFn(item.item, waitWithJitter(ageInSeconds) / 1000);
                    if (updated) {
                        const ts = Date.now();
                        this.cache.byId[id] = { ts, item: updated };
                        this.cache.hasChanged = true;
                    }
                    processed.push(id);
                    if (Date.now() - started > BATCH_TIME) {
                        break;
                    }
                }
                this.updateQueue = lodash_1.difference(lodash_1.uniq(this.updateQueue), processed);
                console.log("processed", ("      " + this.name).substr(-10), processed.length, ">", this.updateQueue.length);
                // console.log("after             ", this.name, this.updateQueue.length)
            }
            setTimeout(() => this.processUpdateQueue().catch(errOut), waitWithJitter(0.1));
        });
    }
    isItemStale(id) {
        if (!this.cache.byId[id]) {
            return false;
        }
        if (!this.cache.byId[id].ts) {
            return true;
        }
        // add jitter to avoid all items are invalidated at the same time
        let maxAgeWithJitter = addJitter(this.refreshItemRateInSeconds);
        let age = this.getAgeInSeconds(id);
        return age > maxAgeWithJitter;
    }
    updateOrClearMemoize() {
        return __awaiter(this, void 0, void 0, function* () {
            // console.log(Object.keys(this.cache.memoize))
            // console.log("---")
            this.cache.memoize = this.cache.memoize || {};
            for (let key of Object.keys(this.cache.memoize)) {
                const info = this.cache.memoize[key];
                info.options.autoUpdate = Math.min(info.options.autoUpdate | 0, MAX_AUTO_UPDATES);
                const ageInSeconds = (Date.now() - info.ts) / 1000 | 0;
                const stale = info.options.stale ? info.options.stale : info.options.ttl;
                const wait = info.options.ttl + (stale - info.options.ttl) / (Math.pow(info.options.autoUpdate, 3) + 1);
                // console.log("wait",wait)
                // console.log("- ", key)
                // console.log(" age   ", ageInSeconds)
                // console.log(" wait  ", wait)
                // console.log(" stale ", stale)
                // console.log(" optio ", info.options)
                if (ageInSeconds > wait) {
                    // console.log(key, info.options, info.fn)
                    if (info.options.autoUpdate > 0 && info.fn) {
                        // console.log("UPDATE ", info.options.autoUpdate)
                        info.options.autoUpdate = info.options.autoUpdate - 1;
                        this.memoize(info.name, info.params, info.options, info.fn);
                    }
                    else if (info.options.stale && (ageInSeconds < info.options.stale)) {
                        // console.log("STALE BUT KEEP")
                    }
                    else {
                        // console.log("REMOVING")
                        delete this.cache.memoize[key];
                    }
                }
            }
            setTimeout(() => this.updateOrClearMemoize().catch(errOut), waitWithJitter(4));
        });
    }
}
exports.CacheUtil = CacheUtil;
function makeCache(parameters) {
    return __awaiter(this, void 0, void 0, function* () {
        let { name, refreshItemFn, refreshItemRateInSeconds } = parameters;
        const cache = new CacheUtil(name, refreshItemFn, refreshItemRateInSeconds);
        yield cache.init();
        return cache;
    });
}
exports.makeCache = makeCache;
//# sourceMappingURL=cacheutil.js.map