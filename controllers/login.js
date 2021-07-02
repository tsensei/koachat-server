const User = require("../models/users");
const bcrypt = require("bcrypt");

const createUser = async (userObject) => {
  const passwordHash = await bcrypt.hash(userObject.password, 10);
  const user = new User({
    userID: userObject.userID,
    username: userObject.username,
    passwordHash: passwordHash,
  });

  try {
    const returnedUser = await user.save();
    console.log("User created");
    return returnedUser;
  } catch (e) {
    if (e.name === "ValidationError") {
      throw "duplicateUsername";
    }
  }
};

const verifyUser = async (userObject) => {
  console.log("verifying", userObject);
  const user = await User.findOne({ username: userObject.username });

  if (user) {
    var validatePassword = await bcrypt.compare(
      userObject.password,
      user.passwordHash
    );
    if (!validatePassword) {
      throw "invalidPassword";
    }
  } else {
    throw "invalidUser";
  }

  return user;
};

module.exports = {
  createUser: createUser,
  verifyUser: verifyUser,
};
