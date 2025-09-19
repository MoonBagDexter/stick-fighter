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

