const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const people = [];
const socketToRoomMap = new Map();

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);
  socket.on("join_room", (data) => {
    socket.join(data.room);
    console.log(`User with ID: ${socket.id} joined room: ${data.room}`);
    socketToRoomMap.set(socket.id, data.room);
    const newPerson = {
      socketId: socket.id,
      name: data.username
    };
    people.push(newPerson);
    socket.to(data.room).emit("welcome_room", people);
  });

  socket.on("send_message", (data) => {
    console.log(data.message, data.author)
    socket.to(data.room).emit("receive_message", data);
  });

  socket.on("disconnect", () => {
    const roomId = socketToRoomMap.get(socket.id);
    const index = people.findIndex((person) => person.socketId === socket.id);
    if (index !== -1) {
      people.splice(index, 1);
      socket.to(roomId).emit("welcome_room", people);
      console.log("User Disconnected from room", socket.id, socket.rooms[1]);
      socketToRoomMap.delete(socket.id);
    }
  });
});

server.listen(3001, () => {
  console.log("SERVER RUNNING");
});