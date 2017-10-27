const { makeExecutableSchema } = require('graphql-tools')
const { readFileSync } = require('fs')

const resolvers = require('./resolvers')
const typeDefs = readFileSync(__dirname + "/schema.graphql", "utf-8")

// Generate the schema object from your types definition.
module.exports = (store) =>
	makeExecutableSchema({ typeDefs, resolvers: resolvers(store) })
