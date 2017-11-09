import { makeExecutableSchema } from "graphql-tools"
import { readFileSync } from "fs"
import resolvers from "./resolvers"
import { IExecutableSchemaDefinition } from "graphql-tools/dist/Interfaces"

const typeDefs = readFileSync("./schema/schema.graphqls", "utf-8")

let schemaDef = { typeDefs, resolvers: resolvers() } as IExecutableSchemaDefinition

module.exports = makeExecutableSchema(schemaDef)