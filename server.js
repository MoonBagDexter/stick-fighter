// modules
const http = require("http");
const path = require("path");
const express = require("express");
const socketIO = require("socket.io");

// classes
const Game = require('./server/classes/Game');

// constants
const PORT = process.env.PORT || 8080;
const FRAME_TIME = Math.floor(1000 / 60);

var app = express();
var server = http.Server(app);
var io = socketIO(server, {pingInterval: 1000});
let game = new Game(io); // initialize game

app.set('port', PORT);
app.use('/img', express.static(__dirname + '/img'));
app.use('/build', express.static(__dirname + '/build'));

// Routing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/views/index.html'));
});

// Server FPS monitoring
let serverFrameCount = 0;
let lastServerFPSCheck = Date.now();

// GAME CLOCK - Optimized 60 FPS loop
setInterval(function() {
  if (game) {
    game.update();
    game.sendState();
    
    // Monitor server FPS
    serverFrameCount++;
    const now = Date.now();
    if (now - lastServerFPSCheck >= 5000) { // Check every 5 seconds
      const serverFPS = Math.round(serverFrameCount * 1000 / (now - lastServerFPSCheck));
      console.log(`Server FPS: ${serverFPS} | Players: ${Object.keys(game.players).length}`);
      serverFrameCount = 0;
      lastServerFPSCheck = now;
    }
  }
}, FRAME_TIME);

// Start the server
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));