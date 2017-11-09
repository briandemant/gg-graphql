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
const fake_1 = require("./fake");
const listing_1 = require("./listing");
const cacheutil_1 = require("./cacheutil");
let FORCE_REFRESH_ITEMS = 24 * 60 * 60;
function fakeUser(id) {
    return {
        id,
        username: fake_1.default.username(id),
        phone: fake_1.default.phone(id),
        has_nemid: false,
        avatar: null,
    };
}
function refreshItemFn(user, ageInSeconds) {
    return __awaiter(this, void 0, void 0, function* () {
        if (ageInSeconds < 5 * 60) {
            return null;
        }
        if (typeof user === "number") {
            return fakeUser(user);
        }
        return null;
    });
}
let cache;
(() => __awaiter(this, void 0, void 0, function* () {
    const params = {
        name: "user",
        refreshItemFn: refreshItemFn,
        refreshItemRateInSeconds: FORCE_REFRESH_ITEMS,
    };
    cache = yield cacheutil_1.makeCache(params);
}))();
class UserRepo {
    static find(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return cache.get(id);
        });
    }
    static listings(id, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            let x = yield listing_1.ListingRepo.search("", 0, id, limit);
            return x.results;
        });
    }
    static saveToCache(user) {
        cache.update(user);
    }
}
exports.UserRepo = UserRepo;
//# sourceMappingURL=user.js.map