const express = require('express');
const { ApolloServer, gql, UserInputError } = require('apollo-server-express');
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const shortid = require('shortid')
const adapter = new FileSync('db.json')
const axios = require('axios')
const db = low(adapter)


// Construct a schema, using GraphQL schema language
const typeDefs = gql`
  type Query {
    todos: [Todo!]!
    todo(id: ID!): Todo
    stockPrice(ticker: String!): String!
    deleteTodo(id: ID!): Boolean!
  }

  type Mutation {
    addTodo(title: String!): Todo!
    toggleTodoStatus(id: ID!): Todo!
  }

  type Todo {
    id: ID!
    title: String!
    completed: Boolean!
  }
`;

// Provide resolver functions for your schema fields
const resolvers = {
  Query: {
    todos: () => {
      return db.get('todos').value()
    },
    todo: (_, { id }) => {
      const todo = db.get('todos').find({ id }).value()
      if (!todo)
        return null
      return todo
    },
    stockPrice: async (_, { ticker }) => {
      const lowercase_ticker = ticker.toLowerCase()
      const url = `https://cloud.iexapis.com/stable/stock/${lowercase_ticker}/quote?token=pk_9334b1ec0de6483c925c78df9a4688f5`
      try {
        const { data: { latestPrice } } = await axios.get(url)
        return latestPrice
      } catch (err) {
        throw new UserInputError(`Could not find the stock with the ticker ${lowercase_ticker}`)
      }

    }
  },
  Mutation: {
    addTodo: (_, { title }) => {
      // assign id, we'll need to find it after pushing
      const new_id = shortid.generate()

      // write new todo
      db.get('todos')
        .push({ id: new_id, title, completed: false })
        .write()

      // find post using new_id
      return db.get('todos').find({ id: new_id }).value()
    },
    toggleTodoStatus: (_, { id }) => {
      const todo = db.get('todos').find({ id }).value()

      if (!todo)
        throw new UserInputError('Todo not found...')

      const updated_todo = db.get('todos').find({ id }).assign({ completed: !todo.completed }).write()

      return updated_todo
    },
    deleteTodo: (_, { id }) => {
      const remove = db.get('toods').remove({ id }).write()
      if (remove)
        return true
      return false
    }
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  playground: true,
  introspection: true
});

const app = express();

server.applyMiddleware({ app });

app.get('/', (req, res) => res.redirect('/graphql'))

app.listen({ port: process.env.PORT || 4000 }, () =>
  console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`)
);

// maybe need l8r?
function resetDatabaseFile() {
  db.defaults({ todos: [] }).write()
}