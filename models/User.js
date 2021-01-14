const { Schema } = (mongoose = require("mongoose"));

// using random string for the avatar
const md5 = require("md5");
// for hashing the user password
const bcrypt = require("bcrypt");

const UserSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    trim: true,
  },
  avatar: {
    type: String,
  },
  joinDate: {
    type: Date,
    default: Date.now,
  },
  favorites: {
    type: [mongoose.Schema.Types.ObjectId],
    required: true,
    ref: "Post",
  },
});

// Create and add Random avatar to user
// before saving user
UserSchema.pre("save", function (next) {
  // md5 will randomize the username string
  this.avatar = `http://gravatar.com/avatar/${md5(this.username)}?d=identicon`;
  next();
});

// Hash password so it cant be seen w/ access to database
UserSchema.pre("save", function (next) {
  // "if NOT modified password - meaning User is Just Singning In" Not creating
  // NEW password NOR editing the Password
  if (!this.isModified("password")) {
    return next();
  }
  // then if user is NEW and about to signing up
  bcrypt.genSalt(10, (err, salt) => {
    if (err) return next(err);

    bcrypt.hash(this.password, salt, (err, hash) => {
      if (err) return next(err);

      this.password = hash;
      next();
    });
  });
});

module.exports = mongoose.model("User", UserSchema);
