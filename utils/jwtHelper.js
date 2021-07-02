const jwt = require("jsonwebtoken");

const createToken = (userID, username) => {
  const userForToken = {
    userID,
    username,
  };
  const token = jwt.sign(userForToken, process.env.SECRET);

  return token;
};

const verifyToken = (token) => {
  const decodedToken = jwt.verify(token, process.env.SECRET);
  if (!decodedToken) {
    console.log("Token Invalid");
  }
  return decodedToken;
};

module.exports = {
  createToken: createToken,
  verifyToken: verifyToken,
};
