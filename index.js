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

const calculateScore = (room) => {
  // is name
  // is animal
  // is place
  // is thing
  const checkMultipleName = {};
  const checkMultiplePlace = {};
  const checkMultipleAnimal = {};
  const checkMultipleThing = {};

  const roomPeople = rooms[room].people;
  const alphabet = rooms[room].currentAlphabet;

  roomPeople.forEach((p) => {
    p.submission.name[0] === alphabet && (checkMultipleName[p.submission.name] ? 
      checkMultiple[p.submission.name] += 1 
      : 
      checkMultiple[p.submission.name] = 1);

    console.log("name", checkMultiple);
    
    p.submission.place[0] === alphabet && (checkMultiplePlace[p.submission.place] ? 
      checkMultiple[p.submission.place] += 1 
      : 
      checkMultiple[p.submission.place] = 1);

    console.log("place", checkMultiple);


    p.submission.animal[0] === alphabet && (checkMultipleAnimal[p.submission.animal] ? 
      checkMultiple[p.submission.animal] += 1 
      : 
      checkMultiple[p.submission.animal] = 1);

    console.log("animal", checkMultiple);

    p.submission.thing[0] === alphabet && (checkMultipleThing[p.submission.thing] ? 
      checkMultiple[p.submission.thing] += 1 
      : 
      checkMultiple[p.submission.thing] = 1);

    console.log("thing", checkMultiple);
  })

  console.log(checkMultiple);

  roomPeople.forEach((p) => {
    checkMultipleName[p.submission.name]     && (checkMultipleName[p.submission.name]     > 1 ? p.score += 5 : p.score += 10);
    checkMultiplePlace[p.submission.place]   && (checkMultiplePlace[p.submission.place]   > 1 ? p.score += 5 : p.score += 10);
    checkMultipleAnimal[p.submission.animal] && (checkMultipleAnimal[p.submission.animal] > 1 ? p.score += 5 : p.score += 10);
    checkMultipleThing[p.submission.thing]   && (checkMultipleThing[p.submission.thing]   > 1 ? p.score += 5 : p.score += 10);
  });

  rooms[room].people = roomPeople;
};

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
      socket.emit("room_exists");
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
  });

  socket.on("send_alphabet", (data) => {
    console.log(data.alphabet, data.room)
    const { room } = data;
    const roomData = rooms[room];
    let username;
    if (roomData) {
      const currentIndex = roomData.people.findIndex((p) => p.isTurn);
      username = roomData.people[currentIndex].name;
    }
    rooms[room].currentAlphabet = data.alphabet.toString();
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
      rooms[room] = roomData;
    }
    rooms[room]?.people.forEach((p) => console.log(p.name, p.isTurn));
    io.to(room).emit("change_turn");
    io.to(data.room).emit("peopleInRoom", rooms[room].people);
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
      console.log(rooms[room].submittedCount);

      if (rooms[room].submittedCount === rooms[room].people.length) {

        // calculate score

          // part1: name place animal thing all start with given alphabet or not
          // part2: check if its valid name, place, animal, thing or not
          // part3: check if its matching with anyothers answers and update score

        calculateScore(room);

        console.log("final submit");
        rooms[room].submittedCount = 0;
        socket.emit("final_submit");
      } else if (rooms[room].submittedCount === 1) {
        console.log("first submit");
        socket.to(room).emit("first_submit");
      }
    }
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