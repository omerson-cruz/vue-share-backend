const { ApolloServer, AuthenticationError } = require("apollo-server");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

// JSON web Token Authorization
const jwt = require("jsonwebtoken");

// Mongoose Models
const User = require("./models/User");
const Post = require("./models/Post");

// GraphQL Type Definitions
const filePath = path.join(__dirname, "typeDefs.gql");
const typeDefs = fs.readFileSync(filePath, "utf-8");
// GraphQL Resolvers
const resolvers = require("./resolvers");

require("dotenv").config({ path: "config.env" });

// helper function
// Verify JWT Token passed from client to see if it is Valid, Malformed or Invalid
// This will be used for protecting the routes for private pages
const getUser = async (token) => {
  if (token) {
    try {
      let user = await jwt.verify(token, process.env.SECRET);
      console.log("user deTokenized: ", user);
      return user;
    } catch (error) {
      console.log("Token Invalid: ", error.message);
      throw new AuthenticationError(
        "Your session has ended. Please sign in again."
      );
    }
  }
};

// Connecting to MongoDB and Setting Configurations
mongoose.set("useCreateIndex", true); // prevents deprecation warning
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("DB connected");
  })
  .catch((err) => {
    console.log("Error: ", err);
  });

const todos = [
  { task: "Wash car", completed: false },
  { task: "Clean room", completed: true },
];

// Instantiating Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  // for providing formatted error in the frontend
  formatError: (error) => {
    console.log("returning an error to client", error);
    return {
      name: error.name,
      message: error.message.replace("Context creation failed:", ""), // <== this will replace that statement with only empty string leaving our only message of
      // "Your session has ended. Please sign in again."
    };
  },

  // context using the Mongoose models by returning an object with Mongoose Models in it
  // context allows us NOT to Import stuffs in the other file directory
  // "request" is the one from Apollo Client "in the main.js" of Vue Client
  context: async (request) => {
    // Extract the Token Starts
    console.log("req authorization header req", request.req.headers);

    const {
      req: { headers },
    } = request;
    console.log("headers->token: ", headers["authorization"]);

    const token = headers["authorization"];
    // END - Extract token from HTTP request

    return {
      //==> return an object of context instead of an context property
      User,
      Post,
      // ==> this will validate the user . Using async/ await here because
      // it's implementation of getUser is also "async/ await" one
      currentUser: await getUser(token),
    };
  },
  // Simple way of accepting requests and the Object version of "Context"
  // context: {
  //     User,
  //     Post,
  //     authScope: (integrationContext) => {
  //         console.log()
  //     }
  // }
}); // <-------- Add this semicolon before the self-executing function below to prevent syntax error

/**
 * Starting the Apollo Server
 */
// put semicolon on the last statement before
// the self-executing function so it will not throw syntax error
(async () => {
  const { url } = await server.listen({ port: process.env.PORT || 4000 });
  console.log(`server listening on ${url}`);
})();
