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
function refreshItemFn(item, ageInSeconds) {
    return __awaiter(this, void 0, void 0, function* () {
        let id;
        if (typeof item === 'number') {
            id = item;
        }
        else {
            id = item.id;
        }
        const data = yield fetch_1.fetchJson(`https://api.guloggratis.dk/modules/gg_app/ad/view`, { id });
        if (data.success) {
            let phone = "";
            try {
                phone = data.tlf ? data.tlf.replace(" ", "").replace(/(\+?[0-9]{2})/g, (x, _, idx) => {
                    return (idx == 0 ? x : ` ${x}`);
                }).trim() : "";
                store_1.UserRepo.saveToCache({ id: data.userid, username: data.username.trim(), phone: phone });
            }
            catch (e) {
                console.log(data);
            }
            return {
                id: id,
                title: data.headline,
                phone: phone,
                description: data.description,
                price: data.price_value,
                user: data.userid,
                category: data.categoryid,
            };
        }
        else {
            item.status = "offline";
            return item;
        }
    });
}
let cache;
(() => __awaiter(this, void 0, void 0, function* () {
    cache = yield cacheutil_1.makeCache("listing", refreshItemFn, 60 * 60 * 24 * 7);
}))();
class ListingRepo {
    static find(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return cache.get(id);
        });
    }
    static findLatest(category, limit = 20) {
        return __awaiter(this, void 0, void 0, function* () {
            let memoize = cache.memoize("latest", { limit: limit, category: category }, {
                ttl: 30,
                stale: 600,
                autoUpdate: 10,
            }, (params) => __awaiter(this, void 0, void 0, function* () {
                const data = yield fetch_1.fetchJson(`https://api.guloggratis.dk/modules/gg_front/latest_items`, {
                    number: params.limit,
                    category_id: params.category,
                });
                return data.map((listing) => listing.adid);
            }));
            return memoize.then((list) => __awaiter(this, void 0, void 0, function* () {
                const listings = [];
                for (let id of list) {
                    let item = yield ListingRepo.find(id);
                    if (item) {
                        listings.push(item);
                    }
                }
                return { count: limit, listings: listings };
            }));
        });
    }
    static search(query, category, user, limit = 20) {
        return __awaiter(this, void 0, void 0, function* () {
            let memoize = cache.memoize("search", { query, limit, user, category }, {
                ttl: 30,
                stale: 60,
                autoUpdate: 1,
            }, (params) => __awaiter(this, void 0, void 0, function* () {
                let url = `https://api.guloggratis.dk/modules/gg_app/search/result`;
                let query = {
                    query: params.query || '',
                    category_id: params.category | 0,
                    uid: params.user | 0,
                };
                const data = yield fetch_1.fetchJson(url, query);
                return {
                    count: data.nr_results,
                    listings: data.results.slice(0, limit).map((listing) => listing.id),
                };
            }));
            return memoize.then((result) => __awaiter(this, void 0, void 0, function* () {
                const listings = [];
                for (let id of result.listings) {
                    let item = yield ListingRepo.find(id);
                    if (item) {
                        listings.push(item);
                    }
                }
                return {
                    count: result.count,
                    listings: listings,
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