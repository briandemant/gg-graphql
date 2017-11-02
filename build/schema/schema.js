"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_tools_1 = require("graphql-tools");
const fs_1 = require("fs");
const resolvers_1 = require("./resolvers");
const store = require('../store/store');
const typeDefs = fs_1.readFileSync("./schema/schema.graphqls", "utf-8");
module.exports = graphql_tools_1.makeExecutableSchema({ typeDefs, resolvers: resolvers_1.default(store) });
//# sourceMappingURL=schema.js.map