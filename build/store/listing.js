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
let FORCE_REFRESH_ITEMS = 4 * 60 * 60;
function refreshItemFn(item, ageInSeconds) {
    return __awaiter(this, void 0, void 0, function* () {
        if (ageInSeconds < 60) {
            return null;
        }
        let id;
        if (typeof item === 'string') {
            item = parseInt(item);
        }
        if (typeof item === 'number') {
            id = item;
            item = {
                id: id,
                title: "",
                phone: "",
                description: "",
                price: 0,
                online: false,
                user: 0,
                category: 0,
                transaction_type: "UNKNOWN",
                address: "",
                zipcode: "",
                city: "",
                country: "",
                images: [],
            };
        }
        else {
            id = item.id;
        }
        if (typeof id == "undefined") {
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
                    return (idx == 0 ? x : ` ${x}`);
                }).trim() : "";
                let avatar = null;
                if (data.profileImage !== "" && data.profileImage) {
                    avatar = data.profileImage.replace(/.*.dk\/[0-9]+\/([0-9]+)_.*/, "$1") | 0;
                }
                store_1.UserRepo.saveToCache({
                    id: data.userid,
                    username: data.username.trim(),
                    phone: phone,
                    has_nemid: data.user_nem_id_validate,
                    avatar: avatar,
                });
            }
            catch (e) {
                console.log(e, data);
                process.exit();
            }
            let transaction_type;
            switch (Object.keys(data.sales_type)[0]) {
                case "1": {
                    transaction_type = "SELL";
                    break;
                }
                case "2": {
                    transaction_type = "BUY";
                    break;
                }
                case "3": {
                    transaction_type = "SELL";
                    break;
                }
                case "4": {
                    transaction_type = "GIVEAWAY";
                    break;
                }
                case "5": {
                    transaction_type = "TO_RENT";
                    break;
                }
                case "6": {
                    transaction_type = "RENT_OUT";
                    break;
                }
                case "8": {
                    transaction_type = "OTHER";
                    break;
                }
                default: {
                    transaction_type = "UNKNOWN";
                }
            }
            let images = lodash_1.flatten(data.sorted_images.map(Object.keys)).map((x) => parseInt(x));
            return {
                id: id,
                title: data.headline,
                phone: phone,
                description: data.descriptionForEditing,
                price: Math.min(2147483600, data.price_value * 100),
                online: data.online,
                user: data.userid,
                category: data.categoryid,
                transaction_type: transaction_type,
                address: data.address,
                zipcode: data.zipcode,
                city: data.city,
                country: data.country,
                images: images,
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
    cache = yield cacheutil_1.makeCache("listing", refreshItemFn, FORCE_REFRESH_ITEMS);
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
    static latest(category, limit = 20) {
        return __awaiter(this, void 0, void 0, function* () {
            let memoize = cache.memoize("latest", { limit: limit, category: category }, {
                ttl: 30,
                stale: 2 * 60 * 60,
                autoUpdate: 10,
            }, (params) => __awaiter(this, void 0, void 0, function* () {
                const data = yield fetch_1.fetchJson(`https://api.guloggratis.dk/modules/gg_front/latest_items`, {
                    number: Math.max(params.limit, 1000),
                    category_id: params.category,
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
                let query = {
                    query: params.query || '',
                    category_id: params.category | 0,
                    uid: params.user | 0,
                };
                const data = yield fetch_1.fetchJson(url, query);
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