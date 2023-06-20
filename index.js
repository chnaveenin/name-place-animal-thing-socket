const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const rooms = {};

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on("check_room", (data) => {
    const { room } = data;
    const roomExists = rooms[room];
    console.log("here in check room", room);

    if (roomExists) {
      socket.emit("generate_new_roomid");
    } else {
      console.log("room is valid");
      socket.emit("roomid_is_valid", { room });
    }
  });

  socket.on("is_room_exists", (data) => {
    const { room } = data;
    const roomExists = rooms[room];
    console.log("here in is room exists", room);

    if (roomExists) {
      socket.emit("room_exists", { room });
    } else {
      socket.emit("room_not_found", { room });
    }
  });

  socket.on("join_room", async (data) => {
    await socket.join(data.room);
    if (rooms[data.room])
      console.log("room is available");
    else {
      console.log("creating room");
      rooms[data.room] = {
        people: [],
        submittedCount: 0,
        currentAlphabet: ''
      };
    }

    console.log(`User with ID: ${socket.id} name: ${data.username} joined room: ${data.room}`);

    const newPerson = {
      socketId: socket.id,
      name: data.username,
      score: 0,
      isTurn: false,
      submission: {
        name: '',
        place: '',
        animal: '',
        thing: ''
      }
    };

    rooms[data.room].people.push(newPerson);

    if (rooms[data.room].people.length === 1) {
      newPerson.isTurn = true;
    }

    rooms[data.room].people.forEach((p) => console.log(p.name, p.isTurn));

    io.to(data.room).emit("peopleInRoom", rooms[data.room].people);
    socket.to(data.room).emit("welcome_message", {
      message: `User ${data.username} has joined the room.`,
      author: "System",
    });

    let username;
    const roomData = rooms[data.room];
    if (roomData) {
      const currentIndex = roomData.people.findIndex((p) => p.isTurn);
      username = roomData.people[currentIndex].name;
    }

    socket.emit("receive_alphabet", {
      name: username,
      alphabet: roomData.currentAlphabet.toUpperCase()
    });
  });

  socket.on("send_alphabet", (data) => {
    console.log(data.alphabet, data.room)
    const { room } = data;
    const roomData = rooms[room];
    let username;
    if (roomData) {
      const currentIndex = roomData.people.findIndex((p) => p.isTurn);
      username = roomData.people[currentIndex].name;
      rooms[room].currentAlphabet = data.alphabet.toString();
    }

    socket.to(data.room).emit("receive_alphabet", {
      name: username,
      alphabet: data.alphabet.toUpperCase()
    });
  });

  socket.on("change_turn", (data) => {
    const { room } = data;
    console.log("changing turn");
    const roomData = rooms[room];
    if (roomData) {
      const currentIndex = roomData.people.findIndex((p) => p.isTurn);
      const nextIndex = (currentIndex + 1) % roomData.people.length;
      roomData.people.forEach((p, index) => {
        p.isTurn = index === nextIndex;
      });
      roomData.currentAlphabet = '';
      rooms[room] = roomData;
    }
    if (rooms[room]) {
      rooms[room].people.forEach((p) => console.log(p.name, p.isTurn));
      io.to(data.room).emit("peopleInRoom", rooms[room].people);
    }
    io.to(room).emit("change_turn");
  });

  socket.on("submit", (data) => {
    const {room, submission} = data;
    if (rooms[room]) {
      rooms[room].submittedCount += 1;
      for (const [key, value] of Object.entries(rooms)) {
        const index = value.people.findIndex((person) => person.socketId === socket.id);
        if (index !== -1) {
          rooms[room].people[index].submission = submission;
          break;
        }
      }

      if (rooms[room].submittedCount === rooms[room].people.length) {
        console.log("final submit");
        rooms[room].submittedCount = 0;
        rooms[room].currentAlphabet = '';
        io.to(room).emit("calculate_score", rooms[room].people);
      }
      else if (rooms[room].submittedCount === 1) {
        console.log("first submit");
        socket.to(room).emit("first_submit");
      }
    }
  });

  socket.on("calculate_score", (data) => {
    console.log("calculating score");
    const {roomid, people} = data;
    const roomPeople = rooms[roomid].people
    if (rooms[roomid]) {
      roomPeople.forEach((p, index) => p.score+=(people[index].newScore ? people[index].newScore : 0));
      rooms[roomid].people = roomPeople;
    }
    socket.emit("calculated_score");
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
    if (roomId)
      console.log(`User with ID: ${socket.id} left room: ${roomId}`);
    else 
      console.log(`User disconnected with ID: ${socket.id}`);

    if (roomId && rooms[roomId].people.length === 0) {
      delete rooms[roomId];
    }
    if (rooms[roomId]) {
      rooms[roomId].people.forEach((p) => console.log(p.name, p.isTurn));
      socket.to(roomId).emit('peopleInRoom', rooms[roomId].people || []);

      if (rooms[roomId].submittedCount === rooms[roomId].people.length) {
        console.log("final submit");
        rooms[roomId].submittedCount = 0;
        rooms[roomId].currentAlphabet = '';
        io.to(roomId).emit("calculate_score", rooms[roomId].people);
      }
    }
  });
});

server.listen(3001, () => {
  console.log("SERVER RUNNING");
});