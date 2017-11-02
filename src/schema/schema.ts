import { makeExecutableSchema } from "graphql-tools"
import { readFileSync } from "fs"
import resolvers from "./resolvers"

const store = require('../store/store')

const typeDefs = readFileSync("./schema/schema.graphqls", "utf-8")

module.exports = makeExecutableSchema({ typeDefs, resolvers: resolvers(store) })

