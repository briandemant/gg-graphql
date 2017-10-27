const express = require('express')

// This package automatically parses JSON requests.
const bodyParser = require('body-parser')

// This package will handle GraphQL server requests and responses
// for you, based on your schema.
const { graphqlExpress, graphiqlExpress } = require('apollo-server-express')


let getStore = require('./store')

const start = async () => {
	const store = await getStore()
	const schema = require('./schema/schema')(store)

	var app = express()
	app.use('/graphql', bodyParser.json(), graphqlExpress({   schema }))
	app.use('/graphiql', graphiqlExpress({
		endpointURL: '/graphql',
	}))

	const PORT = 3000
	app.listen(PORT, () => {
		console.log(`Gul og Gratis GraphQL server running on port ${PORT}.`)
	})
}
start()