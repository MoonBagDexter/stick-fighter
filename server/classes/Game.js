var Player = require('./StickMan');

class Game {

  constructor(io) {
    this.io = io;
    this.players = {};
    this.maxPlayers = 5;

    this.io.on("connection", (socket) => {
      // Check if server is full
      if (Object.keys(this.players).length >= this.maxPlayers) {
        socket.emit("serverFull", "Server is full! Maximum 5 players allowed.");
        socket.disconnect();
        return;
      }
      
      io.sockets.emit("message", `Player at socket ${socket.id} has connected.`);
      this.players[socket.id] = new Player(this, socket.id);

      // set up event listeners
      socket.on("disconnect", (reason) => {
        io.sockets.emit("message", `Player at socket ${socket.id} has disconnected. Reason: ${reason}`);
        delete this.players[socket.id];
      });
  
      socket.on("setButton", ({button, value}) => {
        let player = this.players[socket.id];
        if (player) {
          player.setButton(button, value);
        }
      });

      socket.on("setWallet", (walletAddress) => {
        let player = this.players[socket.id];
        if (player) {
          player.setWallet(walletAddress);
          io.sockets.emit("message", `Player ${player.displayName} has joined the game.`);
        }
      });
    })
  }

  update() {
    Object.values(this.players).forEach((player) => {
      if (player) player.update();
    });
  }

  sendState() {
    let players = Object.values(this.players).map((player) => {
      return player.getDrawInfo();
    });
    
    // Generate leaderboard data
    let leaderboard = Object.values(this.players)
      .filter(player => player.displayName !== 'Player') // Only show players with names
      .map(player => ({
        id: player.id,
        displayName: player.displayName,
        kills: player.kills,
        isAlive: player.isAlive
      }))
      .sort((a, b) => b.kills - a.kills) // Sort by kills descending
      .slice(0, 5); // Top 5 players (matches max player limit)
    
    this.io.sockets.emit("sendState", {
      players: players,
      leaderboard: leaderboard,
    });
  }

  doAttack(attack, attacker) {
    Object.values(this.players).forEach((player) => {
      if (
        player.id !== attacker.id 
        && player.isAlive
        && this.checkCollision(attack.hitbox, attacker.position, player.hurtbox, player.position)
      ) {
        const wasAlive = player.isAlive;
        player.hurt(20); // Deal 20 damage per hit
        attacker.animation.pause(5);
        player.animation.pause(5);
        
        // Check if player died from this attack
        if (wasAlive && !player.isAlive) {
          attacker.addKill();
          this.io.sockets.emit("playerKilled", {
            killerId: attacker.id,
            killerName: attacker.displayName,
            victimId: player.id,
            victimName: player.displayName,
            killerKills: attacker.kills
          });
        }
        
        // Send hit feedback to all clients
        this.io.sockets.emit("playerHit", {
          attackerId: attacker.id,
          victimId: player.id,
          damage: 20,
          victimHealth: player.health,
          wasKilled: wasAlive && !player.isAlive
        });
      }
    });
  }

  checkCollision(box1, box1Pos, box2, box2Pos) {
    return (
      box1Pos.x + box1.offset.x < box2Pos.x + box2.offset.x + box2.size.x
      && box1Pos.x + box1.offset.x + box1.size.x > box2Pos.x + box2.offset.x
      && box1Pos.y + box1.offset.y < box2Pos.y + box2.offset.y + box2.size.y
      && box1Pos.y + box1.offset.y + box1.size.y > box2Pos.y + box2.offset.y
    );
  }
}

module.exports = Game;