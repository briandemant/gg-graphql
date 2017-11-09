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
const fetch_1 = require("../fetch");
const store_1 = require("./store");
const cacheutil_1 = require("./cacheutil");
const lodash_1 = require("lodash");
let FORCE_REFRESH_ITEMS = 24 * 60 * 60;
function refreshItemFn(item, ageInSeconds) {
    return __awaiter(this, void 0, void 0, function* () {
        if (ageInSeconds < 60) {
            return null;
        }
        let id;
        if (typeof item === "string") {
            item = parseInt(item, 10);
        }
        if (typeof item === "number") {
            id = item;
            item = {
                id: id,
                title: "",
                phone: "",
                description: "",
                price: 0,
                online: false,
                createdAt: null,
                user: 0,
                category: 0,
                transaction_type: "UNKNOWN",
                address: "",
                zipcode: "",
                city: "",
                country: "",
                images: [],
                extra: {
                    status: "offline",
                },
            };
        }
        else {
            id = item.id;
        }
        if (typeof id === "undefined") {
            console.log("item", item);
            return null;
        }
        const data = yield fetch_1.fetchJson(`https://api.guloggratis.dk/modules/gg_app/ad/view`, { id });
        // console.log(data)
        // process.exit()
        if (data.success) {
            let phone = "";
            try {
                phone = data.tlf ? data.tlf.replace(" ", "").replace(/(\+?[0-9]{2})/g, (x, _, idx) => {
                    return (idx === 0 ? x : ` ${x}`);
                }).trim() : "";
                let avatar = null;
                if (data.profileImage !== "" && data.profileImage) {
                    avatar = data.profileImage.replace(/.*.dk\/[0-9]+\/([0-9]+)_.*/, "$1") | 0;
                }
                let user = {
                    id: data.userid,
                    username: data.username.trim(),
                    phone: phone,
                    has_nemid: data.user_nem_id_validate,
                    avatar: avatar,
                };
                store_1.UserRepo.saveToCache(user);
            }
            catch (e) {
                console.log(e, data);
                process.exit();
            }
            let transactionType;
            switch (Object.keys(data.sales_type)[0]) {
                case "1": {
                    transactionType = "SELL";
                    break;
                }
                case "2": {
                    transactionType = "BUY";
                    break;
                }
                case "3": {
                    transactionType = "SELL";
                    break;
                }
                case "4": {
                    transactionType = "GIVEAWAY";
                    break;
                }
                case "5": {
                    transactionType = "TO_RENT";
                    break;
                }
                case "6": {
                    transactionType = "RENT_OUT";
                    break;
                }
                case "8": {
                    transactionType = "OTHER";
                    break;
                }
                default: {
                    transactionType = "UNKNOWN";
                }
            }
            let images = lodash_1.flatten(data.sorted_images.map(Object.keys))
                .map((x) => parseInt(x, 10));
            return {
                id: id,
                title: data.headline + " " + data.num_online_days,
                phone: phone,
                description: data.descriptionForEditing,
                price: Math.min(2147483600, data.price_value * 100),
                online: data.online,
                // createdAt: "" + data.end,
                // createdAt: new Date(Date.now() - data.num_online_days * 24 * 60 * 60 * 1000).toISOString(),
                createdAt: new Date(data.end * 1000 - 8 * 7 * 24 * 60 * 60 * 1000).toISOString(),
                user: data.userid,
                category: data.categoryid,
                transaction_type: transactionType,
                address: data.address,
                zipcode: data.zipcode,
                city: data.city,
                country: data.country,
                images: images,
                // end: new Date(data.end).toISOString(),
                // isBusiness: data.isBusiness,
                // isPaid: data.isPaid,
                // numOnlineDays: data.num_online_days,
                // website: data.website,
                // location: data.location ? data.location.split(",") : null,
                extra: { status: "ok" },
            };
        }
        item.extra = item.extra || { status: "offline" };
        item.extra.status = "offline";
        return item;
    });
}
let cache;
(() => __awaiter(this, void 0, void 0, function* () {
    let params = {
        name: "listing",
        refreshItemFn: refreshItemFn,
        refreshItemRateInSeconds: FORCE_REFRESH_ITEMS,
    };
    cache = yield cacheutil_1.makeCache(params);
}))();
class ListingRepo {
    static find(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return cache.get(id);
        });
    }
    static findButDontUpdate(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return cache.get(id, false);
        });
    }
    static front(limit = 20) {
        return __awaiter(this, void 0, void 0, function* () {
            let memoize = cache.memoize("latest", { limit: limit }, {
                ttl: 30,
                stale: 2 * 60 * 60,
                autoUpdate: 10,
            }, (params) => __awaiter(this, void 0, void 0, function* () {
                const data = yield fetch_1.fetchJsonP(`https://mit.guloggratis.dk/modules/gg_front/front_page_items`, {
                    callback: "jQuery18309420386967396377_1510152448069",
                    page: 1,
                    perPage: Math.max(params.limit, 100),
                });
                return data.data.map((listing) => listing.adid);
            }));
            return memoize.then((list) => __awaiter(this, void 0, void 0, function* () {
                const results = [];
                list = lodash_1.shuffle(list);
                list = limit > 0 ? list.slice(0, limit) : list;
                for (let id of list) {
                    let item = yield ListingRepo.find(id);
                    if (item) {
                        results.push(item);
                    }
                }
                return { count: limit, results: results };
            }));
        });
    }
    static latestX(category, limit = 20) {
        return __awaiter(this, void 0, void 0, function* () {
            let memoize = cache.memoize("latest", { limit: limit, category: category }, {
                ttl: 30,
                stale: 2 * 60 * 60,
                autoUpdate: 10,
            }, (params) => __awaiter(this, void 0, void 0, function* () {
                const data = yield fetch_1.fetchJson(`https://api.guloggratis.dk/modules/gg_front/latest_items`, {
                    number: Math.max(params.limit, 100),
                    category_id: params.category | 0,
                });
                return data.map((listing) => listing.adid);
            }));
            return memoize.then((list) => __awaiter(this, void 0, void 0, function* () {
                const results = [];
                list = limit > 0 ? list.slice(0, limit) : list;
                for (let id of list) {
                    let item = yield ListingRepo.find(id);
                    if (item) {
                        results.push(item);
                    }
                }
                return { count: limit, results: results };
            }));
        });
    }
    static latest(category, limit = 20) {
        return __awaiter(this, void 0, void 0, function* () {
            category = typeof category === "undefined" ? 0 : category;
            let memoize = cache.memoize("latest", { category }, {
                ttl: 30,
                stale: 2 * 60 * 60,
                autoUpdate: 10,
            }, (params) => __awaiter(this, void 0, void 0, function* () {
                let url = `https://api.guloggratis.dk/modules/gg_app/search/result`;
                let q = {
                    query: "",
                    category_id: params.category | 0,
                    sort: "created",
                    order: "desc",
                };
                const data = yield fetch_1.fetchJson(url, q);
                return {
                    count: data.nr_results,
                    results: data.results.map((listing) => listing.id),
                };
            }));
            return memoize.then((result) => __awaiter(this, void 0, void 0, function* () {
                const results = [];
                let list = limit > 0 ? result.results.slice(0, limit) : result.results;
                for (let id of list) {
                    let item = yield ListingRepo.find(id);
                    if (item) {
                        results.push(item);
                    }
                }
                return {
                    count: result.count,
                    results: results,
                };
            }));
        });
    }
    static search(query, category, user, limit = 20) {
        return __awaiter(this, void 0, void 0, function* () {
            query = typeof query === "undefined" ? "" : query;
            category = typeof category === "undefined" ? 0 : category;
            user = typeof user === "undefined" ? 0 : user;
            let memoize = cache.memoize("search", { query, user, category }, {
                ttl: 30,
                stale: 2 * 60 * 60,
                autoUpdate: 10,
            }, (params) => __awaiter(this, void 0, void 0, function* () {
                let url = `https://api.guloggratis.dk/modules/gg_app/search/result`;
                let q = {
                    query: params.query || "",
                    category_id: params.category | 0,
                    uid: params.user | 0,
                };
                const data = yield fetch_1.fetchJson(url, q);
                return {
                    count: data.nr_results,
                    results: data.results.map((listing) => listing.id),
                };
            }));
            return memoize.then((result) => __awaiter(this, void 0, void 0, function* () {
                const results = [];
                let list = limit > 0 ? result.results.slice(0, limit) : result.results;
                for (let id of list) {
                    let item = yield ListingRepo.find(id);
                    if (item) {
                        results.push(item);
                    }
                }
                return {
                    count: result.count,
                    results: results,
                };
            }));
        });
    }
    static saveToCache(listing) {
        cache.update(listing);
    }
}
exports.ListingRepo = ListingRepo;
//# sourceMappingURL=listing.js.map