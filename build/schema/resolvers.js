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
const category_1 = require("../store/category");
const listing_1 = require("../store/listing");
const user_1 = require("../store/user");
const image_1 = require("../store/image");
exports.default = () => {
    return {
        Query: {
            category: (root, { id }, ctx) => category_1.CategoryRepo.find(id),
            category_roots: (root, { id }, ctx) => category_1.CategoryRepo.roots(),
            user: (root, { id }, ctx) => user_1.UserRepo.find(id),
            image: (root, { id, size }, ctx) => image_1.ImageRepo.find(id, size),
            listing: (root, { id }, ctx) => listing_1.ListingRepo.find(id),
            listing_latest: (root, { limit, category }, ctx) => listing_1.ListingRepo.latest(category, limit),
            listing_search: (root, { query, limit, category, user }, ctx) => listing_1.ListingRepo.search(query, category, user, limit),
        },
        Category: {
            parents: ({ parents }) => parents.map((id) => category_1.CategoryRepo.find(id)),
            parent: ({ parents }) => parents.length > 0 ? category_1.CategoryRepo.find(parents[0]) : null,
            children: ({ children }, { with_count }, x, meta) => {
                // console.log("\n\nPath", JSON.stringify(meta.path.prev.prev, null, 3))
                // if (meta.path.prev.prev && meta.path.prev.prev.prev && meta.path.prev.prev.prev.prev && meta.path.prev.prev.prev.prev.prev) {
                // 	throw new Error("too many nested children")
                // }
                return children.map((id) => category_1.CategoryRepo.find(id)).filter((cat) => !with_count || cat.count > 0);
            },
        },
        User: {
            avatar: ({ avatar }, { size }, ctx, meta) => {
                return avatar ? image_1.ImageRepo.find(avatar, size) : avatar;
            },
            extra: (root) => ({ user: root }),
        },
        UserExtra: {
            listings: (root, { limit }, ctx) => __awaiter(this, void 0, void 0, function* () {
                return user_1.UserRepo.listings(root.user.id, limit);
            }),
        },
        Image: {
            url: ({ id, size }) => image_1.toImageUrl(id, size),
        },
        Listing: {
            user: ({ user }) => user_1.UserRepo.find(user),
            category: ({ category }) => category_1.CategoryRepo.find(category),
            images: (root, { size }, ctx, meta) => {
                // console.log("root", root)
                // console.log("size", size)
                // console.log("meta", meta)
                const { images } = root;
                return images.map((id) => image_1.ImageRepo.find(id, size));
            },
        },
    };
};
//# sourceMappingURL=resolvers.js.map