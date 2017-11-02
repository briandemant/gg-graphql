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
const cacheutil_1 = require("./cacheutil");
function fakeUser(id) {
    return { id, username: fake_1.default.username(id), phone: fake_1.default.phone(id) };
}
function refreshItemFn(user, ageInSeconds) {
    return __awaiter(this, void 0, void 0, function* () {
        if (typeof user === "number")
            return fakeUser(user);
        return user;
    });
}
let cache;
(() => __awaiter(this, void 0, void 0, function* () {
    cache = yield cacheutil_1.makeCache("user", refreshItemFn, 60 * 60 * 24 * 365);
}))();
class UserRepo {
    static find(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return cache.get(id);
        });
    }
    static saveToCache(user) {
        cache.update(user);
    }
}
exports.UserRepo = UserRepo;
//# sourceMappingURL=user.js.map