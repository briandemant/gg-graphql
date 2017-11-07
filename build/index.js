var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const express = require('express');
// This package automatically parses JSON requests.
const bodyParser = require('body-parser');
// This package will handle GraphQL server requests and responses
// for you, based on your schema.
const { graphqlExpress, graphiqlExpress } = require('apollo-server-express');
const start = () => __awaiter(this, void 0, void 0, function* () {
    const schema = require('./schema/schema');
    var app = express();
    app.use('/graphql', bodyParser.json(), graphqlExpress({ schema }));
    app.use('/*', graphiqlExpress({ endpointURL: '/graphql' }));
    const PORT = process.env.PORT || 3002;
    app.listen(PORT, () => {
        console.log(`Gul og Gratis GraphQL server running on port ${PORT}.`);
    });
});
start();
//# sourceMappingURL=index.js.map