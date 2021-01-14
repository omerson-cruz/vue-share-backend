const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// this will create the JSON Web token
/**
 * argv2 - secret - Set in our Environment variable
 */
const createToken = (user, secret, expiresIn) => {
  const { username, email } = user;
  return jwt.sign({ username, email }, secret, { expiresIn });
};

module.exports = {
  // ############################ //
  // ########  QUERY ############ //
  // ############################ //
  Query: {
    /**
     * argv1 -root
     * argv2 - arguments to GQL query/mutation
     * argv3 - context set in the server.js, usually mongoose models
     */
    // currentUser will allow us to search in our Mongoose Database
    getCurrentUser: async (_, args, { User, currentUser }) => {
      if (!currentUser) {
        console.log("Trying to get Current User but it's null");
        return null; // return if current user is not present
      }
      const user = await User.findOne({
        username: currentUser.username,
      }).populate({
        path: "favorites", // favorites referencing the Post model
        model: "Post",
      });

      console.log("Query.getCurrentUser", user);
      return user;
    },

    getUser: async (_, { username }, context, info) => {
      const { User, Post } = context;

      return await User.findOne({ username: username });
    },

    /**
     * getting current User's Posts
     */
    getUserPosts: async (_, { userId }, { Post }) => {
      const posts = await Post.find({
        createdBy: userId,
      });

      return posts;
    },

    getPosts: async (_, arguments, context) => {
      const { Post } = context;

      const posts = await Post.find({}).sort({ createdDate: "desc" }).populate({
        path: "createdBy",
        model: "User",
      });
      return posts;
    },

    // Get individual Post
    getPost: async (_, { postId }, { Post }) => {
      const post = await Post.findOne({ _id: postId }).populate({
        path: "messages.messageUser",
        model: "User",
      });
      return post;
    },

    infiniteScrollPosts: async (_, { pageNum, pageSize }, { Post }) => {
      let posts;

      console.log("infiniteScroll triggered");

      // This is also the one being used for Pagination
      // tag: Pagination Algorithm the infinitescroll style
      if (pageNum === 1) {
        posts = await Post.find({})
          .sort({ createdDate: "desc" })
          .populate({
            path: "createdBy",
            model: "User",
          })
          .limit(pageSize);
      } else {
        //If page number is greater than one, figure out how many documents to skip
        // THis is some sort of pagination as well
        const skips = pageSize * (pageNum - 1);
        posts = await Post.find({})
          .sort({ createdDate: "desc" })
          .populate({
            path: "createdBy",
            model: "User",
          })
          .skip(skips)
          .limit(pageSize);
      }

      const totalDocs = await Post.countDocuments();
      const hasMore = totalDocs > pageSize * pageNum;

      console.log("posts", posts);
      console.log("hasMore", hasMore);
      return { posts, hasMore };
    },

    searchPosts: async (_, { searchTerm }, { Post }) => {
      if (searchTerm) {
        // ==> if searchTerm not empty
        const searchResults = await Post.find(
          // [[13 -1 @02:50 - using $text operator, and search according to searchTerms]]
          { $text: { $search: searchTerm } },
          // [[13 -1 @03:50 ]]
          // Assign 'searchTerm' a text score to provide BEST MATCH
          { score: { $meta: "textScore" } }
          // and then sort according to that "textScore"
          /** so below were simply saying sort according to the score and also likes in desc order */
        )
          .sort({
            score: { $meta: "textScore" },
            likes: "desc",
          })
          .limit(5); // limit the returned result of find()

        return searchResults;
      }
    },
  },

  // ############################ //
  // ########  MUTATION  ######## //
  // ############################ //

  // argv3 - context here contains the object we passed on the "server.js" file
  // which is the User and Post Model
  Mutation: {
    // signIn user
    signinUser: async (_, { username, password }, { User }) => {
      const user = await User.findOne({ username });
      if (!user) {
        throw new Error("User not found");
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        throw new Error("Invalid Password");
      }

      // return user
      // so instead of returning the user we are going to
      // create this token and return to the client
      return { token: createToken(user, process.env.SECRET, "1hr") };
    },

    // signupUser: async (parent, { username, email, password}, context)
    signupUser: async (_, { username, email, password }, { User }) => {
      const user = await User.findOne({ username });
      if (user) {
        throw new Error("User already exists");
      }

      const newUser = await new User({
        username,
        email,
        password,
      }).save();

      console.log("newUser", {
        ...newUser.toObject(),
      });

      //    return {
      //         ...newUser.toObject(),
      //         password: null,
      //         joinDate: newUser._doc.joinDate.toISOString()
      //    }

      //  Instead of returning a User we are going to return a Token
      return { token: createToken(newUser, process.env.SECRET, "1hr") };
    },

    // Adding Post
    addPost: async (_, arguments, context) => {
      const { title, imageUrl, categories, description, creatorId } = arguments;

      const { User, Post } = context;

      try {
        const newPost = await new Post({
          title,
          imageUrl,
          categories,
          description,
          createdBy: creatorId,
        }).save();

        return newPost;
      } catch (error) {
        throw error;
      }
    },

    /**
     * EDIT EXISTING POST / UPDATE EXISTING POST
     */
    updateUserPost: async (
      _,
      { postId, userId, title, imageUrl, description, categories },
      { Post }
    ) => {
      const post = await Post.findOneAndUpdate(
        // Find post by post Id and createdBy user ID
        { _id: postId, createdBy: userId },
        // { $set: { "title": title, "imageUrl": imageUrl, "categories": categories, "description": description}}
        { $set: { title, imageUrl, categories, description } }, //==> using shorthand syntax
        { new: true }
      ).populate({
        path: "createdBy",
        model: "User",
      });

      return post;
    },

    /**
     * DELETE USER POST
     */
    deleteUserPost: async (_, { postId }, { Post }) => {
      const post = await Post.findOneAndRemove({ _id: postId });
      return post;
    },

    // Adding Messages or Comments to a Post
    addPostMessage: async (_, { messageBody, userId, postId }, { Post }) => {
      /**
       * Let's first construct this new message we gonna add to MongoDB
       */
      const newMessage = {
        messageBody,
        messageUser: userId,
      };

      // find the Post entity where this message will be added
      const post = await Post.findOneAndUpdate(
        // find post by id
        { _id: postId },
        // Algorithm for prepending or putting in a specific index of the array with MongoDB/Mongoose
        // Ususally {$push} will put the new item to the last part of the array
        //    But with {$each: [<objectToBeAdded>], position in array where you want to add }
        { $push: { messages: { $each: [newMessage], $position: 0 } } },

        // after saving to MongoDB. Let's return fresh document after update
        { new: true }
      ).populate({
        path: "messages.messageUser",
        model: "User",
      });

      console.log("post message: ", post);

      // "zero" index is where we put the latest message
      // You'll notice that implicitly the "Mongoose" puts an "_id:" property ObjectId
      // in the message object id
      return post.messages[0];
    },

    // For LIKING Post
    likePost: async (_, { postId, username }, { Post, User }) => {
      // Find Post, add 1 to it's 'like' value
      const post = await Post.findOneAndUpdate(
        { _id: postId },
        { $inc: { likes: 1 } },

        { new: true } // after increment we are going to return the updated value or mutated document
      );

      // Find User, Add id of Post from it's favorites array ( which will be populated as Posts)

      const user = await User.findOneAndUpdate(
        { username },
        { $addToSet: { favorites: postId } },
        { new: true } // after adding to array of favorites for the User model we are going to return the updated value plus the populated Post Mongoose model
      ).populate({
        path: "favorites",
        model: "Post",
      });

      // As per typeDefs.gql Return only Number of likes from 'post' and favorites array from 'user' model
      return {
        likes: post.likes,
        favorites: user.favorites,
      };
    },

    // For UNLIKING Post
    unlikePost: async (_, { postId, username }, { Post, User }) => {
      // Find Post, add 1 to it's 'like' value
      const post = await Post.findOneAndUpdate(
        { _id: postId },
        { $inc: { likes: -1 } },

        { new: true } // after increment we are going to return the updated value or mutated document
      );

      // Find User, Remove id of Post from it's favorites array ( which will be populated as Posts)

      const user = await User.findOneAndUpdate(
        { username },
        // $pull will remove the Post Id from the array of user's favorites
        // $pull is the opposite of the $addToSet
        { $pull: { favorites: postId } },
        { new: true } // after adding to array of favorites for this model we are going to return the updated value
      ).populate({
        path: "favorites",
        model: "Post",
      });

      // As per typeDefs.gql Return only Number of likes from 'post' and favorites array from 'user' model
      return {
        likes: post.likes,
        favorites: user.favorites,
      };
    },
  },
};
