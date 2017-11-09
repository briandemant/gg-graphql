"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_tools_1 = require("graphql-tools");
const fs_1 = require("fs");
const resolvers_1 = require("./resolvers");
const typeDefs = fs_1.readFileSync("./schema/schema.graphqls", "utf-8");
let schemaDef = { typeDefs, resolvers: resolvers_1.default() };
module.exports = graphql_tools_1.makeExecutableSchema(schemaDef);
//# sourceMappingURL=schema.js.map