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
const lodash_1 = require("lodash");
const cacheutil_1 = require("./cacheutil");
function refreshItemFn(category, ageInSeconds) {
    return __awaiter(this, void 0, void 0, function* () {
        let id;
        if (typeof category === 'number') {
            id = category;
            category = {
                id: id,
                level: -1,
                title: '',
                count: 0,
                slug: '/',
                title_slug: '',
                parents: [],
                children: [],
                can_create: false,
            };
        }
        else {
            id = category.id;
        }
        category.level = category.parents.length;
        if (ageInSeconds < 60) {
            return null;
        }
        // else if (ageInSeconds>46)
        // throw new Error("ageInSeconds")
        // console.log("category", id, category.title_slug)
        try {
            const count = yield fetch_1.fetchJson(`https://api.guloggratis.dk/modules/gg_app/search/result`, {
                category_id: id,
                pagenr: 100000,
            });
            category.count = count.nr_results;
            if (ageInSeconds < 2 * 60 * 60 || ageInSeconds === 0) {
                // console.log(">>only update count")
                return category;
            }
            else {
                const catInfo = yield fetch_1.fetchJson(`https://api.guloggratis.dk/modules/gg_app/category/data`, { id });
                const childInfo = yield fetch_1.fetchJson(`https://api.guloggratis.dk/modules/gulgratis/ajax/ad_creator.fetch_categories_for_select.php`, { parent_categoryid: id });
                category.title = catInfo.name;
                category.slug = catInfo.GAScreenValue;
                const previousChildren = category.children;
                category.children = childInfo.categories.map((x) => x.categoryid);
                // category.children = childInfo.categories.slice(0, 4).map(x => x.categoryid)
                // console.log("before", previousChildren)
                // console.log("after", category.children)
                let diff = lodash_1.difference(previousChildren, category.children);
                // console.log("difference", diff)
                yield removeChildren(diff);
                if (category.id == 0) {
                    category.level = -1;
                }
                else {
                    category.level = category.parents.length;
                    if (category.level === 0) {
                        category.title_slug = category.title;
                    }
                }
                if (catInfo.can_create) {
                    category.can_create = true;
                }
                for (let childId of category.children) {
                    const child = yield cache.get(childId, false);
                    if (category.id > 0 && child) {
                        if (category.parents.length > 0) {
                            child.title_slug = `${category.title_slug}/${child.title}`;
                            child.parents = [category.id, ...category.parents].filter(x => x > 0);
                            child.level = child.parents.length;
                        }
                        else {
                            child.level = 0;
                            child.title_slug = `${category.title}/${child.title}`;
                            child.parents = [category.id];
                        }
                    }
                }
                return category;
            }
        }
        catch (e) {
            console.error(id, category, e);
            category.status = "error";
            return category;
        }
    });
}
function removeChildren(children) {
    return __awaiter(this, void 0, void 0, function* () {
        for (let id of children) {
            let child = yield cache.get(id);
            if (child) {
                yield removeChildren(child.children);
            }
            cache.remove(id);
        }
    });
}
let cache;
function rebuildTree() {
    return __awaiter(this, void 0, void 0, function* () {
        // CategoryRepo.roots().catch((err) => console.log(err))
        // cache.get(373).catch((err) => console.log(err))
        // cache.get(374).catch((err) => console.log(err))
    });
}
(() => __awaiter(this, void 0, void 0, function* () {
    cache = yield cacheutil_1.makeCache("category", refreshItemFn, 2 * 24 * 60 * 60);
    rebuildTree().catch((err) => console.log(err));
}))();
class CategoryRepo {
    static find(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return cache.get(id);
        });
    }
    static roots() {
        return __awaiter(this, void 0, void 0, function* () {
            const root = yield cache.get(0);
            const result = [];
            if (root !== null) {
                for (let childId of root.children) {
                    let child = yield cache.get(childId);
                    if (child) {
                        result.push(child);
                    }
                }
            }
            return result;
        });
    }
    static saveToCache(category) {
        cache.update(category);
    }
}
exports.CategoryRepo = CategoryRepo;
//# sourceMappingURL=category.js.map