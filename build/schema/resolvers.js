"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ({ CategoryRepo, UserRepo, ListingRepo }) => {
    return {
        Query: {
            category: (root, { id }, ctx) => CategoryRepo.find(id),
            category_roots: (root, { id }, ctx) => CategoryRepo.roots(),
            user: (root, { id }, ctx) => UserRepo.find(id),
            listing: (root, { id }, ctx) => ListingRepo.find(id),
            listing_latest: (root, { limit, category }, ctx) => ListingRepo.findLatest(category, limit),
            listing_search: (root, { query, limit, category, user }, ctx) => ListingRepo.search(query, category, user, limit),
        },
        Category: {
            parents: ({ parents }) => parents.map(id => CategoryRepo.find(id)),
            parent: ({ parents }) => parents.length > 0 ? CategoryRepo.find(parents[0]) : null,
            children: ({ children }, { with_count }) => {
                return children.map(id => CategoryRepo.find(id)).filter((cat) => !with_count || cat.count > 0);
            },
        },
        User: {},
        Listing: {
            user: ({ user }) => UserRepo.find(user),
            category: ({ category }) => CategoryRepo.find(category),
        },
    };
};
//# sourceMappingURL=resolvers.js.map