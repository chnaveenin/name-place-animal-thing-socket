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

const rooms = {};

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);
  socket.on("join_room", async (data) => {
    if (rooms[data.room]) {
      await socket.join(data.room);
      console.log("room is available");
    } else {
      rooms[data.room] = {
        people: []
      }
      console.log("room is not available, creating new room");
    }
    console.log(`User with ID: ${socket.id} joined room: ${data.room}`);

    const newPerson = {
      socketId: socket.id,
      name: data.username,
      score: 0,
      isTurn: false
    };

    rooms[data.room].people.push(newPerson);
    if (rooms[data.room].people.length === 1) {
      newPerson.isTurn = true;
    }

    rooms[data.room].people.forEach((p) => console.log(p.name, p.isTurn));

    io.to(data.room).emit("peopleInRoom", rooms[data.room].people);
    socket.to(data.room).emit("receive_message", {
      message: `User ${data.username} has joined the room.`,
      author: "System",
    });
  });

  socket.on("send_message", (data) => {
    console.log(data.message, data.author)
    const { room } = data;
    const roomData = rooms[room];
    if (roomData) {
      const currentIndex = roomData.people.findIndex((p) => p.isTurn);
      const nextIndex = (currentIndex + 1) % roomData.people.length;
      roomData.people.forEach((p, index) => {
        p.isTurn = index === nextIndex;
      });
      rooms[room] = roomData;
    }
    rooms[room].people.forEach((p) => console.log(p.name, p.isTurn));
    socket.to(data.room).emit("receive_message", data);
    io.to(data.room).emit("peopleInRoom", rooms[room].people);
  });

  socket.on("disconnect", () => {
    let roomId;
    for (const [key, value] of Object.entries(rooms)) {
      const index = value.people.findIndex((person) => person.socketId === socket.id);
      if (index !== -1) {
        roomId = key;
        let flag = value.people[index].isTurn
        value.people.splice(index, 1);
        if (value.people.length > 0 && flag) {
          const nextIndex = index % value.people.length;
          console.log(index, nextIndex);
          value.people.forEach((person, i) => {
            console.log(person.name)
            return person.isTurn = i === nextIndex;
          });
          rooms[roomId].people = value.people;
        }
        break;
      }
    }
    console.log(`User with ID: ${socket.id} left room: ${roomId}`);

    if (roomId && rooms[roomId].people.length === 0) {
      delete rooms[roomId];
    }
    rooms[roomId]?.people.forEach((p) => console.log(p.name, p.isTurn));
    socket.to(roomId).emit('peopleInRoom', rooms[roomId]?.people || []);
  });
});

server.listen(3001, () => {
  console.log("SERVER RUNNING");
});