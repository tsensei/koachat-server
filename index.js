require("dotenv").config();
const express = require("express");
const app = express();
const httpServer = require("http").createServer(app);
const mongoose = require("mongoose");
//Production
const io = require("socket.io")(httpServer);
//Local dev.
// const io = require("socket.io")(httpServer, {
//   cors: {
//     origin: "http://localhost:3000",
//   },
// });
const crypto = require("crypto");
const jwtHelper = require("./utils/jwtHelper.js");
const loginService = require("./controllers/login");

//MongoDB connection
const url = process.env.MONGODB_URL;
//Store all connected socket userID

//{id,userID,username}
let onlineUsers = [];

app.use(express.static("build"));

(async () => {
  await mongoose.connect(url, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  });

  console.log("Connected to mongodb");
})();

//Authentication middleware
io.use(async (socket, next) => {
  const recievedData = socket.handshake.auth;
  if (recievedData.type === "jwt") {
    console.log("authtype token");
    const token = recievedData.token;
    const user = jwtHelper.verifyToken(token);
    //Check if user instance is alread connected
    //if connected,refuse connection
    const instaceRunning = onlineUsers.find((onUser) => {
      return onUser.userID === user.userID;
    });
    if (instaceRunning) {
      return next(new Error("another instace running"));
    }
    socket.username = user.username;
    socket.userID = user.userID;

    return next();
  } else if (recievedData.type === "login") {
    const user = {
      username: recievedData.username,
      password: recievedData.password,
    };
    try {
      const returnedUser = await loginService.verifyUser(user);
      socket.username = returnedUser.username;
      socket.userID = returnedUser.userID;
      console.log("user verified");
    } catch (e) {
      if (e === "invalidUser") {
        return next(new Error("invalid user"));
      } else if (e === "invalidPassword") {
        return next(new Error("wrong password"));
      }
    }
  } else if (recievedData.type === "signup") {
    socket.userID = crypto.randomBytes(4).toString("hex");
    const user = {
      userID: socket.userID,
      username: recievedData.username,
      password: recievedData.password,
    };

    try {
      const returnedUser = await loginService.createUser(user);
      socket.username = returnedUser.username;
      socket.userID = returnedUser.userID;
      socket.newUser = true;
    } catch (e) {
      if (e === "duplicateUsername") {
        return next(new Error("duplicate username"));
      }
    }
  }
  socket.token = jwtHelper.createToken(socket.userID, recievedData.username);
  next();
});

io.on("connection", (socket) => {
  socket.join(socket.userID);
  //Send token n login or signup
  if (socket.token) {
    socket.emit("token", socket.token);
  }
  //Notify successfull user creation
  if (socket.newUser) {
    socket.emit("successfullUserCreation");
  }

  //Send username and userID
  socket.emit("userInfo", {
    username: socket.username,
    userID: socket.userID,
  });

  //Sends current online users (except own)
  socket.emit("onlineUsers", onlineUsers);

  onlineUsers.push({
    id: socket.id,
    userID: socket.userID,
    username: socket.username,
  });

  socket.broadcast.emit("userConn", {
    id: socket.id,
    userID: socket.userID,
    username: socket.username,
  });

  console.log(`${socket.username} connected`);

  socket.on("private message", ({ content, to, time }) => {
    socket.to(to).emit("private message", {
      from: socket.userID,
      content: content,
      time: time,
    });
  });

  socket.on("disconnect", () => {
    console.log(`${socket.username} disconnected`);
    //Remove socket from online user
    onlineUsers = onlineUsers.filter((user) => {
      return user.userID !== socket.userID;
    });
    socket.broadcast.emit("userDisconn", socket.userID);
  });
});

//Server listening init
const port = process.env.PORT || 3001;
httpServer.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
