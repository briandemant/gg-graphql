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
const lodash_1 = require("lodash");
exports.default = () => {
    // noinspection TsLint
    return {
        Query: {
            category: (_, { id }) => {
                return category_1.CategoryRepo.find(id);
            },
            category_roots: () => {
                return category_1.CategoryRepo.roots();
            },
            user: (_, { id }) => {
                return user_1.UserRepo.find(id);
            },
            image: (_, { id, size }) => {
                return image_1.ImageRepo.find(id, size);
            },
            listing: (_, { id }) => {
                return listing_1.ListingRepo.find(id);
            },
            listing_latest: (_, { limit, category }) => {
                return listing_1.ListingRepo.latest(category, limit);
            },
            listing_front: (_, { limit }) => {
                return listing_1.ListingRepo.front(limit);
            },
            listing_search: (_, { query, limit, category, user }) => {
                return listing_1.ListingRepo.search(query, category, user, limit);
            },
        },
        Category: {
            parents: ({ parents }) => parents.map((id) => category_1.CategoryRepo.find(id)),
            parent: ({ parents }) => parents.length > 0 ? category_1.CategoryRepo.find(parents[0]) : null,
            children: ({ children }, { with_count }) => {
                return children.map((id) => category_1.CategoryRepo.find(id)).filter((cat) => !with_count || cat.count > 0);
            },
        },
        User: {
            avatar: ({ avatar }, { size }) => {
                return avatar ? image_1.ImageRepo.find(avatar, size) : avatar;
            },
            listings: (root, { limit }) => __awaiter(this, void 0, void 0, function* () {
                return user_1.UserRepo.listings(root.user.id, limit);
            }),
        },
        Image: {
            url: ({ id, size }) => image_1.toImageUrl(id, size),
        },
        Listing: {
            user: ({ user }) => user_1.UserRepo.find(user),
            category: ({ category }) => category_1.CategoryRepo.find(category),
            images: (root, { size }) => {
                const { images } = root;
                return images.map((id) => image_1.ImageRepo.find(id, size));
            },
            image: (root, { size }) => {
                const { images } = root;
                if (images.length > 0) {
                    return image_1.ImageRepo.find(images[0], size);
                }
                else {
                    return null;
                }
            },
            related: (root, { limit }, ctx, meta) => __awaiter(this, void 0, void 0, function* () {
                limit = limit || 20;
                const { id, category } = root;
                // get too many so that we can shuffle
                let res = yield listing_1.ListingRepo.search("", category, 0, limit * 4);
                let related = res.results.filter(listing => listing.id !== id);
                return lodash_1.shuffle(related).slice(0, limit);
            }),
        },
    };
};
//# sourceMappingURL=resolvers.js.map