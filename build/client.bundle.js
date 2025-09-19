(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const SpriteLoader = require("./SpriteLoader");

class DrawHandler {
  constructor(canvas) {
    this.canvas = canvas;
    // Enable GPU acceleration and optimize context
    this.context = canvas.getContext('2d', {
      alpha: false,              // No transparency for better performance
      desynchronized: true,      // Allow async rendering
      willReadFrequently: false  // Optimize for writing, not reading
    });
    
    // GPU rendering optimizations
    this.context.imageSmoothingEnabled = false; // Crisp pixel art
    this.context.webkitImageSmoothingEnabled = false;
    this.context.mozImageSmoothingEnabled = false;
    this.context.msImageSmoothingEnabled = false;
    
    let spriteLoader = new SpriteLoader();
    this.sprites = spriteLoader.sprites;
    
    // Pre-calculate common values
    this.canvasWidth = canvas.width;
    this.canvasHeight = canvas.height;
    
    // Interpolation for smooth movement
    this.lastState = null;
    this.interpolationFactor = 0;
    this.lastUpdateTime = 0;
  }

  draw(state) {
    // High-performance clear using fillRect (faster than clearRect)
    this.context.fillStyle = 'white';
    this.context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    if (state.players) {
      // Calculate interpolation for smooth movement
      const now = performance.now();
      const deltaTime = now - this.lastUpdateTime;
      this.interpolationFactor = Math.min(deltaTime / 16.67, 1); // 60 FPS target
      
      // Sort players by depth for proper rendering order
      const sortedPlayers = state.players.slice().sort((a, b) => a.position.y - b.position.y);
      
      // Batch rendering for better performance
      sortedPlayers.forEach((player) => {
        let renderPos = player.position;
        
        // Interpolate position if we have previous state
        if (this.lastState && this.lastState.players) {
          const lastPlayer = this.lastState.players.find(p => p.id === player.id);
          if (lastPlayer) {
            renderPos = {
              x: this.lerp(lastPlayer.position.x, player.position.x, this.interpolationFactor),
              y: this.lerp(lastPlayer.position.y, player.position.y, this.interpolationFactor)
            };
          }
        }
        
        // Optimized drawing with GPU acceleration
        this.drawPlayerOptimized(player, renderPos);
      });
      
      this.lastState = JSON.parse(JSON.stringify(state)); // Deep copy for interpolation
      this.lastUpdateTime = now;
    }

    if (state.latency) {
      this.context.fillStyle='blue';
      this.context.font = "12px Arial";
      this.context.fillText(`Ping: ${state.latency}ms`, 10, 20);
    }
    
    if (state.fps) {
      this.context.fillStyle='green';
      this.context.font = "12px Arial";
      this.context.fillText(`FPS: ${state.fps}`, 10, 40);
    }
    
    // Draw leaderboard
    if (state.leaderboard) {
      this.drawLeaderboard(state.leaderboard);
    }
  }

  drawHealthBar(player) {
    if (!player.isAlive) {
      // Draw "DEAD" text for dead players
      this.context.fillStyle = 'red';
      this.context.font = "14px Arial";
      this.context.textAlign = 'center';
      this.context.fillText('DEAD - Press K to respawn', player.position.x, player.position.y - 40);
      this.context.textAlign = 'left';
      return;
    }

    const barWidth = 60;
    const barHeight = 8;
    const barX = player.position.x - barWidth / 2;
    const barY = player.position.y - 30;
    
    // Background (red)
    this.context.fillStyle = 'red';
    this.context.fillRect(barX, barY, barWidth, barHeight);
    
    // Health (green)
    const healthPercentage = player.health / player.maxHealth;
    this.context.fillStyle = 'green';
    this.context.fillRect(barX, barY, barWidth * healthPercentage, barHeight);
    
    // Border
    this.context.strokeStyle = 'black';
    this.context.lineWidth = 1;
    this.context.strokeRect(barX, barY, barWidth, barHeight);
    
    // Health text
    this.context.fillStyle = 'white';
    this.context.font = "10px Arial";
    this.context.textAlign = 'center';
    this.context.fillText(`${player.health}/${player.maxHealth}`, player.position.x, barY + 6);
    this.context.textAlign = 'left';
  }

  // Optimized player drawing with GPU acceleration
  drawPlayerOptimized(player, renderPos) {
    // Use integer positions for crisp rendering
    const x = Math.round(renderPos.x);
    const y = Math.round(renderPos.y);
    
    // Draw shadow first (depth sorting)
    this.sprites['stickmanShadow'].draw(this.context, x, y);
    
    // Draw player sprite
    const {spriteKey, index} = player.animation;
    this.sprites[spriteKey].drawIndex(this.context, index, x, y);
    
    // Draw wallet name above player
    this.drawPlayerName(player, x, y);
    
    // Draw health bar
    this.drawHealthBarOptimized(player, x, y);
  }

  // Optimized health bar drawing
  drawHealthBarOptimized(player, x, y) {
    if (!player.isAlive) {
      // Cache font settings
      this.context.fillStyle = 'red';
      this.context.font = "14px Arial";
      this.context.textAlign = 'center';
      
      if (player.canRespawn) {
        this.context.fillText('DEAD - Press K to respawn', x, y - 40);
      } else {
        const timeLeft = Math.ceil(player.respawnTimeLeft / 1000);
        this.context.fillText(`DEAD - Respawn in ${timeLeft}s`, x, y - 40);
      }
      
      this.context.textAlign = 'left';
      return;
    }

    const barWidth = 60;
    const barHeight = 8;
    const barX = x - 30; // Pre-calculated barWidth / 2
    const barY = y - 30;
    
    // Use save/restore for efficient state management
    this.context.save();
    
    // Draw background (red) - single fillRect call
    this.context.fillStyle = 'red';
    this.context.fillRect(barX, barY, barWidth, barHeight);
    
    // Draw health (green) - single fillRect call
    const healthWidth = Math.round(barWidth * (player.health / player.maxHealth));
    this.context.fillStyle = 'green';
    this.context.fillRect(barX, barY, healthWidth, barHeight);
    
    // Draw border - single strokeRect call
    this.context.strokeStyle = 'black';
    this.context.lineWidth = 1;
    this.context.strokeRect(barX, barY, barWidth, barHeight);
    
    // Draw health text
    this.context.fillStyle = 'white';
    this.context.font = "10px Arial";
    this.context.textAlign = 'center';
    this.context.fillText(`${player.health}/${player.maxHealth}`, x, barY + 6);
    
    this.context.restore();
  }

  // Draw player wallet name above character
  drawPlayerName(player, x, y) {
    if (!player.displayName) return;
    
    this.context.save();
    
    // Name styling
    this.context.fillStyle = '#2c3e50';
    this.context.font = 'bold 12px Arial';
    this.context.textAlign = 'center';
    this.context.strokeStyle = 'white';
    this.context.lineWidth = 3;
    
    // Draw name with outline for visibility
    const nameY = y - 50; // Above health bar
    this.context.strokeText(player.displayName, x, nameY);
    this.context.fillText(player.displayName, x, nameY);
    
    this.context.restore();
  }

  // Draw leaderboard in top right corner
  drawLeaderboard(leaderboard) {
    if (!leaderboard || leaderboard.length === 0) return;
    
    this.context.save();
    
    // Leaderboard positioning
    const boardWidth = 200;
    const lineHeight = 18;
    const boardX = this.canvasWidth - boardWidth - 10;
    const boardY = 10;
    
    // Title
    this.context.fillStyle = 'black';
    this.context.font = 'bold 16px Arial';
    this.context.textAlign = 'left';
    this.context.fillText('LEADERBOARD', boardX, boardY + 16);
    
    // Underline for title
    this.context.strokeStyle = 'black';
    this.context.lineWidth = 1;
    this.context.beginPath();
    this.context.moveTo(boardX, boardY + 20);
    this.context.lineTo(boardX + 140, boardY + 20);
    this.context.stroke();
    
    // Player entries
    leaderboard.forEach((player, index) => {
      const entryY = boardY + 40 + (index * lineHeight);
      
      // Player name (left side)
      this.context.fillStyle = 'black';
      this.context.font = '12px Arial';
      this.context.textAlign = 'left';
      
      const maxNameLength = 15;
      let displayName = player.displayName;
      if (displayName.length > maxNameLength) {
        displayName = displayName.substring(0, maxNameLength - 3) + '...';
      }
      
      // Add status indicator for dead players
      const nameText = player.isAlive ? displayName : `${displayName} (DEAD)`;
      this.context.fillText(`${index + 1}. ${nameText}`, boardX, entryY);
      
      // Dotted line separator
      this.context.strokeStyle = 'black';
      this.context.lineWidth = 1;
      this.context.setLineDash([2, 2]);
      this.context.beginPath();
      const nameWidth = this.context.measureText(`${index + 1}. ${nameText}`).width;
      const lineStart = boardX + nameWidth + 5;
      const lineEnd = boardX + boardWidth - 30;
      this.context.moveTo(lineStart, entryY - 3);
      this.context.lineTo(lineEnd, entryY - 3);
      this.context.stroke();
      this.context.setLineDash([]); // Reset dash
      
      // Kill count (right side)
      this.context.fillStyle = 'black';
      this.context.font = 'bold 12px Arial';
      this.context.textAlign = 'right';
      this.context.fillText(`${player.kills}`, boardX + boardWidth - 10, entryY);
    });
    
    this.context.restore();
  }

  // Linear interpolation utility
  lerp(start, end, factor) {
    return start + (end - start) * factor;
  }
}

module.exports = DrawHandler;
},{"./SpriteLoader":3}],2:[function(require,module,exports){
class Sprite {
  constructor(image, cellSize, offset) {
    this.image = image;
    this.cellSize = cellSize;
    this.offset = offset;
  }

  draw(context, x, y) {
    this.drawIndex(context, 0, x, y);
  }

  drawIndex(context, index, x, y) {
    // Pre-calculate values for better performance
    const sourceX = this.cellSize.x * index;
    const destX = Math.round(x + this.offset.x); // Integer positions for crisp rendering
    const destY = Math.round(y + this.offset.y);
    
    // Optimized drawImage call with integer coordinates
    context.drawImage(
      this.image,
      sourceX,
      0,
      this.cellSize.x,
      this.cellSize.y,
      destX,
      destY,
      this.cellSize.x,
      this.cellSize.y
    );
  }
}

module.exports = Sprite;
},{}],3:[function(require,module,exports){

const Sprite = require("./Sprite");
const IMG_PATH = "/img";

const spriteData = [
  {
    spriteKey: 'stickman',
    filename: 'stickman.png',
    cellSize: {x: 64, y: 64},
    offset: {x: -32, y: -62}
  },
  {
    spriteKey: 'stickmanR',
    filename: 'stickmanR.png',
    cellSize: {x: 64, y: 64},
    offset: {x: -32, y: -62}
  },
  {
    spriteKey: 'stickmanAttacks',
    filename: 'stickmanAttacks.png',
    cellSize: {x: 128, y: 64},
    offset: {x: -96, y: -62}
  },
  {
    spriteKey: 'stickmanAttacksR',
    filename: 'stickmanAttacksR.png',
    cellSize: {x: 128, y: 64},
    offset: {x: -32, y: -62}
  },
  {
    spriteKey: 'stickmanShadow',
    filename: 'stickmanShadow.png',
    cellSize: {x: 64, y: 32},
    offset: {x: -32, y: -16}
  }
];

class SpriteLoader {
  constructor() {
    this.sprites = {};
    
    spriteData.forEach(({spriteKey, filename, cellSize, offset}) => {
      let image = new Image();
      image.src = IMG_PATH + '/' + filename;
      let sprite = new Sprite(image, cellSize, offset);
      this.sprites[spriteKey] = sprite;
    });
  }
}

module.exports = SpriteLoader;


},{"./Sprite":2}],4:[function(require,module,exports){
const DrawHandler = require("./classes/DrawHandler");

// Wallet popup management
class WalletPopup {
  constructor() {
    this.popup = document.getElementById('wallet-popup');
    this.walletInput = document.getElementById('wallet-input');
    this.walletPreview = document.getElementById('wallet-preview');
    this.joinGameBtn = document.getElementById('join-game-btn');
    this.useRandomBtn = document.getElementById('use-random-btn');
    this.walletError = document.getElementById('wallet-error');
    this.canvasContainer = document.getElementById('canvas-container');
    
    this.playerWallet = null;
    this.init();
  }
  
  init() {
    // Input validation and preview
    this.walletInput.addEventListener('input', (e) => {
      const value = e.target.value.trim();
      this.validateAndPreview(value);
    });
    
    // Join game with wallet
    this.joinGameBtn.addEventListener('click', () => {
      const wallet = this.walletInput.value.trim();
      if (this.isValidSolanaAddress(wallet)) {
        this.joinGame(wallet);
      }
    });
    
    // Use random name
    this.useRandomBtn.addEventListener('click', () => {
      const randomWallet = this.generateRandomWallet();
      this.joinGame(randomWallet);
    });
    
    // Enter key to join
    this.walletInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !this.joinGameBtn.disabled) {
        this.joinGameBtn.click();
      }
    });
  }
  
  validateAndPreview(wallet) {
    this.walletError.textContent = '';
    
    if (!wallet) {
      this.walletPreview.textContent = '';
      this.joinGameBtn.disabled = true;
      return;
    }
    
    if (this.isValidSolanaAddress(wallet)) {
      const displayName = this.formatWalletDisplay(wallet);
      this.walletPreview.textContent = `Display name: ${displayName}`;
      this.walletPreview.style.color = '#4CAF50';
      this.joinGameBtn.disabled = false;
    } else {
      this.walletPreview.textContent = 'Invalid Solana wallet address';
      this.walletPreview.style.color = '#f44336';
      this.joinGameBtn.disabled = true;
    }
  }
  
  isValidSolanaAddress(address) {
    // Solana addresses are base58 encoded and 32-44 characters long
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address);
  }
  
  formatWalletDisplay(wallet) {
    if (wallet.length < 6) return wallet;
    return `${wallet.substring(0, 3)}...${wallet.substring(wallet.length - 3)}`;
  }
  
  generateRandomWallet() {
    // Generate a fake but valid-looking Solana address for testing
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 44; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  joinGame(wallet) {
    this.playerWallet = wallet;
    this.popup.style.display = 'none';
    this.canvasContainer.classList.remove('game-hidden');
    
    // Initialize game connection with wallet
    initializeGame(wallet);
  }
}

// Initialize wallet popup
const walletPopup = new WalletPopup();

let socket;

function initializeGame(playerWallet) {
  socket = io();
  
  // Send wallet address when connecting
  socket.on('connect', () => {
    socket.emit('setWallet', playerWallet);
  });
  
  socket.on("message", function(data) {
    console.log(data);
  })

  const keyMap = {
    87: 'up',
    83: 'down',
    65: 'left',
    68: 'right',
    75: 'attack',
  }

  var inputs = {}
  var analogInputs = {x: 0, y: 0} // For smooth joystick input

  const setButton = (button, value) => {
    if (button !== undefined && inputs[button] !== value) {
      inputs[button] = value;
      socket.emit("setButton", {button: button, value: value});
    }
  }

  const setAnalogInput = (x, y) => {
    if (analogInputs.x !== x || analogInputs.y !== y) {
      analogInputs.x = x;
      analogInputs.y = y;
      
      // Convert analog input to digital buttons for compatibility
      const threshold = 0.3;
      setButton('left', x < -threshold);
      setButton('right', x > threshold);
      setButton('up', y < -threshold);
      setButton('down', y > threshold);
    }
  }

// Event listeners
document.addEventListener("keydown", function(e) {
  let button = keyMap[e.keyCode];
  setButton(button, true);
});

document.addEventListener("keyup", function(e) {
  let button = keyMap[e.keyCode];
  setButton(button, false);
});

const canvas = document.getElementById('canvas');
const drawHandler = new DrawHandler(canvas);

var currentLatency = 0;
var lastFrameTime = 0;
var frameCount = 0;
var fps = 0;

// FPS counter
function updateFPS() {
  const now = performance.now();
  frameCount++;
  
  if (now - lastFrameTime >= 1000) {
    fps = Math.round(frameCount * 1000 / (now - lastFrameTime));
    frameCount = 0;
    lastFrameTime = now;
  }
}

// Optimized rendering with GPU sync
let pendingState = null;
let isRendering = false;

function renderFrame() {
  if (pendingState && !isRendering) {
    isRendering = true;
    
    // Use requestAnimationFrame for GPU-synced rendering
    requestAnimationFrame(() => {
      drawHandler.draw(pendingState);
      updateFPS();
      isRendering = false;
      pendingState = null;
    });
  }
}

// DRAW WHEN STATE IS RECEIVED - Optimized
socket.on("sendState", function(state) {
  state.latency = currentLatency;
  state.fps = fps;
  
  // Store state and render on next frame for smooth GPU sync
  pendingState = state;
  renderFrame();
})

socket.on('pong', function(latency) {
  currentLatency = latency;
});

  // Handle hit feedback
  socket.on('playerHit', function(data) {
    if (data.wasKilled) {
      console.log(`💀 KILL! Player ${data.attackerId} eliminated Player ${data.victimId}!`);
    } else {
      console.log(`Player ${data.attackerId} hit Player ${data.victimId} for ${data.damage} damage! Victim health: ${data.victimHealth}`);
    }
  });

  // Handle kill notifications
  socket.on('playerKilled', function(data) {
    console.log(`🏆 ${data.killerName} eliminated ${data.victimName}! (${data.killerKills} kills)`);
    // You could add kill feed notifications here
  });

  // Handle server full message
  socket.on('serverFull', function(message) {
    alert(message + '\n\nPlease try again later when a slot opens up.');
    // Redirect back to wallet popup or show retry option
    window.location.reload();
  });

// Mobile Controls
class MobileControls {
  constructor() {
    this.joystick = {
      base: document.getElementById('joystick-base'),
      knob: document.getElementById('joystick-knob'),
      container: document.getElementById('joystick-container'),
      active: false,
      startPos: {x: 0, y: 0},
      currentPos: {x: 0, y: 0},
      touchId: null // Track which touch is controlling the joystick
    };
    
    this.attackButton = document.getElementById('attack-button');
    this.virtualInputs = {up: false, down: false, left: false, right: false, attack: false};
    
    // Multitouch tracking
    this.activeTouches = new Map(); // touchId -> {element, type}
    
    this.initMultitouch();
  }
  
  initMultitouch() {
    // Unified touch start handler
    document.addEventListener('touchstart', (e) => {
      e.preventDefault();
      
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        
        // Check if touch is on joystick
        if (this.isElementOrChild(element, this.joystick.base)) {
          this.handleJoystickStart(touch);
        }
        // Check if touch is on attack button
        else if (this.isElementOrChild(element, this.attackButton)) {
          this.handleAttackStart(touch);
        }
      }
    });
    
    // Unified touch move handler
    document.addEventListener('touchmove', (e) => {
      e.preventDefault();
      
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const touchInfo = this.activeTouches.get(touch.identifier);
        
        if (touchInfo) {
          if (touchInfo.type === 'joystick') {
            this.updateJoystick(touch.clientX, touch.clientY);
          }
          // Attack button doesn't need move handling
        }
      }
    });
    
    // Unified touch end handler
    document.addEventListener('touchend', (e) => {
      e.preventDefault();
      
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const touchInfo = this.activeTouches.get(touch.identifier);
        
        if (touchInfo) {
          if (touchInfo.type === 'joystick') {
            this.handleJoystickEnd(touch);
          } else if (touchInfo.type === 'attack') {
            this.handleAttackEnd(touch);
          }
          
          this.activeTouches.delete(touch.identifier);
        }
      }
    });
    
    // Handle touch cancel (when user drags off screen, etc.)
    document.addEventListener('touchcancel', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const touchInfo = this.activeTouches.get(touch.identifier);
        
        if (touchInfo) {
          if (touchInfo.type === 'joystick') {
            this.handleJoystickEnd(touch);
          } else if (touchInfo.type === 'attack') {
            this.handleAttackEnd(touch);
          }
          
          this.activeTouches.delete(touch.identifier);
        }
      }
    });
  }
  
  updateJoystick(clientX, clientY) {
    const deltaX = clientX - this.joystick.startPos.x;
    const deltaY = clientY - this.joystick.startPos.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const maxDistance = 40; // Max distance from center
    
    if (distance <= maxDistance) {
      this.joystick.currentPos = {x: deltaX, y: deltaY};
    } else {
      const angle = Math.atan2(deltaY, deltaX);
      this.joystick.currentPos = {
        x: Math.cos(angle) * maxDistance,
        y: Math.sin(angle) * maxDistance
      };
    }
    
    // Update knob position
    this.joystick.knob.style.transform = `translate(-50%, -50%) translate(${this.joystick.currentPos.x}px, ${this.joystick.currentPos.y}px)`;
    
    // Calculate normalized analog input (-1 to 1)
    const normalizedX = this.joystick.currentPos.x / maxDistance;
    const normalizedY = this.joystick.currentPos.y / maxDistance;
    
    // Send smooth analog input
    setAnalogInput(normalizedX, normalizedY);
  }
  
  resetJoystick() {
    this.joystick.knob.style.transform = 'translate(-50%, -50%)';
    this.joystick.currentPos = {x: 0, y: 0};
    this.joystick.active = false;
    this.joystick.touchId = null;
    
    // Reset to no movement
    setAnalogInput(0, 0);
  }
  
  // Individual touch handlers for multitouch support
  handleJoystickStart(touch) {
    if (this.joystick.active) return; // Only one joystick touch at a time
    
    this.joystick.active = true;
    this.joystick.touchId = touch.identifier;
    
    const rect = this.joystick.base.getBoundingClientRect();
    this.joystick.startPos = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    
    this.activeTouches.set(touch.identifier, {
      element: this.joystick.base,
      type: 'joystick'
    });
    
    this.updateJoystick(touch.clientX, touch.clientY);
  }
  
  handleJoystickEnd(touch) {
    if (this.joystick.touchId === touch.identifier) {
      this.resetJoystick();
    }
  }
  
  handleAttackStart(touch) {
    this.activeTouches.set(touch.identifier, {
      element: this.attackButton,
      type: 'attack'
    });
    
    this.virtualInputs.attack = true;
    setButton('attack', true);
    
    // Visual feedback
    this.attackButton.style.transform = 'scale(0.95)';
  }
  
  handleAttackEnd(touch) {
    this.virtualInputs.attack = false;
    setButton('attack', false);
    
    // Reset visual feedback
    this.attackButton.style.transform = 'scale(1)';
  }
  
  // Utility function to check if element is target or child of target
  isElementOrChild(element, target) {
    if (!element || !target) return false;
    
    let current = element;
    while (current) {
      if (current === target) return true;
      current = current.parentElement;
    }
    return false;
  }
  
}

  // Initialize mobile controls
  const mobileControls = new MobileControls();
}


},{"./classes/DrawHandler":1}]},{},[4]);
