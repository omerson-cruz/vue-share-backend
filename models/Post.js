const { Schema } = (mongoose = require("mongoose"));

const PostSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  categories: {
    type: [String],
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
  likes: {
    type: Number,
    default: 0,
  },

  // property('createdBy') === path
  // ref('User') === model
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  messages: [
    {
      /**
       * This _id is being added implicity for every
       * message object inside messages Array
       */
      // _id: {
      //   type: mongoose.Schema.Type.ObjectId,
      //   required: true
      // }
      messageBody: {
        type: String,
        required: true,
      },
      messageDate: {
        type: Date,
        default: Date.now,
      },
      messageUser: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "User",
      },
    },
  ],
});

// [[13 - 1 @00:40 - Optimizing our Post Search index ]]
// Create index to search on all fields of posts
PostSchema.index({
  "$**": "text", //=> this simply means we want to do text search in our Post Schema's fields
});

module.exports = mongoose.model("Post", PostSchema);
