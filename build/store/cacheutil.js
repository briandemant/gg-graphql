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
const { promisify } = require('util');
const fs = require('fs');
const zlib = require('zlib');
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const unzipAsync = promisify(zlib.unzip);
const gzipAsync = promisify(zlib.gzip);
const MAX_AUTO_UPDATES = 10;
const useZip = process.env.ENV !== "develop";
console.log("useZip", useZip);
process.exit();
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
            // console.log(`saved ${name} cache`)
        }
    });
}
function waitWithJitter(wait) {
    return wait * 1000 * (0.8 + 0.3 * Math.random()) | 0;
}
class CacheUtil {
    constructor(name, refreshItemFn, refreshItemRateInSeconds) {
        this.name = name;
        this.refreshItemFn = refreshItemFn;
        this.refreshItemRateInSeconds = refreshItemRateInSeconds;
        this.runningPromises = {};
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            this.cache = yield loadFromDisk(this.name);
            this.cache.name = this.name;
            setTimeout(() => {
                this.autoRefreshItems().catch((err) => console.error(err));
                this.saveCache().catch((err) => console.error(err));
                this.updateOrClearMemoize().catch((err) => console.error(err));
            }, 1000);
        });
    }
    saveCache() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!process.env.NOW) {
                if (this.cache.hasChanged) {
                    // console.log(`saveCache ${ this.name}`)
                    yield saveToDisk(this.name, this.cache).catch((err) => console.error(err));
                }
                setTimeout(() => {
                    this.saveCache().catch((err) => console.error(err));
                }, waitWithJitter(2));
            }
        });
    }
    updateOrClearMemoize() {
        return __awaiter(this, void 0, void 0, function* () {
            // console.log(Object.keys(this.cache.memoize))
            this.cache.memoize = this.cache.memoize || {};
            for (let key of Object.keys(this.cache.memoize)) {
                const info = this.cache.memoize[key];
                const lifetime = info.options.ttl * 2;
                if (Date.now() - info.ts > lifetime * 1000) {
                    info.options.autoUpdate = Math.min(info.options.autoUpdate - 1, MAX_AUTO_UPDATES);
                    info.options.autoUpdate = info.options.autoUpdate - 1;
                    // console.log(key, info.options, info.fn)
                    if (info.options.autoUpdate > 0 && info.fn) {
                        this.memoize(info.name, info.params, info.options, info.fn);
                    }
                    else {
                        delete this.cache.memoize[key];
                    }
                }
            }
            setTimeout(() => {
                this.updateOrClearMemoize().catch((err) => console.error(err));
            }, waitWithJitter(2));
        });
    }
    autoRefreshItems() {
        return __awaiter(this, void 0, void 0, function* () {
            // console.log(`autoRefreshItems ${ this.name}`)
            for (let item of this.all()) {
                if (this.isItemStale(item.id)) {
                    let ageInSeconds = this.getAgeInSeconds(item.id);
                    console.log(this.name, item.id, item.title || item.username, ageInSeconds);
                    const updated = yield this.refreshItemFn(item, ageInSeconds);
                    // console.log("updated",updated)
                    if (updated && (updated != item || item.hasChanged)) {
                        const ts = Date.now();
                        delete item.hasChanged;
                        this.cache.byId[item.id] = { ts, item: updated };
                        this.cache.hasChanged = true;
                    }
                }
            }
            let sleep = waitWithJitter(Math.max(this.refreshItemRateInSeconds / 100, 2));
            // console.log("SLEEP ", sleep, this.name, this.refreshItemRateInSeconds)
            setTimeout(() => {
                this.autoRefreshItems().catch((err) => console.error(err));
            }, sleep);
        });
    }
    getAgeInSeconds(id) {
        return (Date.now() - this.cache.byId[id].ts) / 1000 | 0;
    }
    get(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const cached = this.cache.byId[id];
            if (typeof cached !== 'undefined') {
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
        return limit == 0 ? all : all.slice(0, limit);
    }
    update(item) {
        this.cache.hasChanged = true;
        this.cache.byId[item.id] = {
            ts: Date.now(),
            item,
        };
        return item;
    }
    isItemStale(id) {
        if (!this.cache.byId[id])
            return false;
        if (!this.cache.byId[id].ts)
            return true;
        // add jitter to avoid all items are invalidated at the same time
        let maxAgeWithJitter = waitWithJitter(this.refreshItemRateInSeconds);
        let age = this.getAgeInSeconds(id);
        return age > maxAgeWithJitter;
    }
    memoize(name, params, options, fn) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `${name}::${JSON.stringify(params)}`;
            this.cache.memoize = this.cache.memoize || {};
            let result = this.cache.memoize[key];
            if (result && Date.now() < result.ts + options.ttl * 1000) {
                console.log("ttl ok");
                return result.value;
            }
            this.runningPromises[key] = this.runningPromises[key] || fn(params).then((value) => {
                delete this.runningPromises[key];
                // console.log("REFRESHING CACHE .. done")
                Promise.all(value).then((x) => {
                    this.cache.memoize[key] = {
                        ts: Date.now(),
                        name: name,
                        params: params,
                        options: options,
                        fn: fn,
                        value: x,
                    };
                });
                return value;
            });
            if (result && options.stale && Date.now() < result.ts + options.stale * 1000) {
                console.log("stale ok");
                return result.value;
            }
            else {
                console.log("need update");
                return this.runningPromises[key];
            }
        });
    }
}
exports.CacheUtil = CacheUtil;
function makeCache(name, refreshItemFn, refreshItemRateInSeconds) {
    return __awaiter(this, void 0, void 0, function* () {
        const cache = new CacheUtil(name, refreshItemFn, refreshItemRateInSeconds);
        yield cache.init();
        return cache;
    });
}
exports.makeCache = makeCache;
//# sourceMappingURL=cacheutil.js.map