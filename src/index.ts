const express = require('express')

// This package automatically parses JSON requests.
const bodyParser = require('body-parser')

// This package will handle GraphQL server requests and responses
// for you, based on your schema.
const { graphqlExpress, graphiqlExpress } = require('apollo-server-express')


const start = async () => {
	const schema = require('./schema/schema')

	var app = express()
	app.use('/graphql', bodyParser.json(), graphqlExpress({ schema }))
	app.use('/*', graphiqlExpress({ endpointURL: '/graphql' }))

	const PORT = process.env.PORT || 3002
	app.listen(PORT, () => {
		console.log(`Gul og Gratis GraphQL server running on port ${PORT}.`)
	})
}
start()