const Animation = require('./Animation');

const actions = {
  NONE: 'none',
  HURT: 'hurt',
  ATTACK: {
    PUNCH: 'attack.punch'
  },
}

const attacks = {
  punch: {
    hitbox: {
      size: {x: 80, y: 40}, // Increased from 56x24 to 80x40
      offset: {x: -80, y: -20} // Adjusted for larger hitbox
    }
  },
  punchR: {
    hitbox: {
      size: {x: 80, y: 40}, // Increased from 56x24 to 80x40
      offset: {x: 0, y: -20} // Adjusted for larger hitbox
    }
  }
}

class StickMan {
  constructor(game, id) {
    this.game = game;
    this.id = id;
    this.position = {x: 200 + Math.random() * 400, y: 200 + Math.random() * 200}; // Random spawn within bounds
    this.hurtbox = {
      size: {x: 60, y: 32}, // Increased from 44x12 to 60x32
      offset: {x: -30, y: -16} // Adjusted to keep centered
    };
    this.movespeed = 5; // Single speed value for smooth movement
    this.facingRight = false;
    this.input = {};
    this.velocity = {x: 0, y: 0}; // Smooth velocity for 360-degree movement
    
    // Health system
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.isAlive = true;
    
    // Wallet address for display name
    this.walletAddress = null;
    this.displayName = 'Player';
    
    // Kill tracking
    this.kills = 0;
    
    // Death cooldown system
    this.deathTime = null;
    this.respawnCooldown = 2000; // 2 seconds in milliseconds

    this.animations = {
      stand: new Animation('stickman', 0, 3, 4, true),
      standR: new Animation('stickmanR', 0, 3, 4, true),
      run: new Animation('stickman', 3, 4, 3, true),
      runR: new Animation('stickmanR', 3, 4, 3, true),
      hurt: new Animation('stickman', 7, 5, 3, false),
      hurtR: new Animation('stickmanR', 7, 5, 3, false),
      punch: new Animation('stickmanAttacks', 0, 6, 3, false),
      punchR: new Animation('stickmanAttacksR', 0, 6, 3, false),
    };

    this.animations.punch.onIndex( 3, () => {this.game.doAttack(attacks.punch, this)} );
    this.animations.punchR.onIndex( 3, () => {this.game.doAttack(attacks.punchR, this)} );

    this.action = actions.NONE;
    this.animation = this.animations['stand']; 
  }

  update() {
    // Dead players can't do anything except respawn (with cooldown)
    if (!this.isAlive) {
      if (this.input.attack && this.canRespawn()) {
        this.respawn();
      }
      return;
    }

    // Calculate smooth movement vector (works in all states)
    let inputVector = {x: 0, y: 0};
    if (this.input.left) inputVector.x -= 1;
    if (this.input.right) inputVector.x += 1;
    if (this.input.up) inputVector.y -= 1;
    if (this.input.down) inputVector.y += 1;

    // Normalize diagonal movement for consistent speed
    const inputMagnitude = Math.sqrt(inputVector.x * inputVector.x + inputVector.y * inputVector.y);
    if (inputMagnitude > 0) {
      inputVector.x = (inputVector.x / inputMagnitude) * this.movespeed;
      inputVector.y = (inputVector.y / inputMagnitude) * this.movespeed;
    }

    // Smooth velocity interpolation for fluid movement
    const smoothing = 0.8;
    this.velocity.x = this.velocity.x * smoothing + inputVector.x * (1 - smoothing);
    this.velocity.y = this.velocity.y * smoothing + inputVector.y * (1 - smoothing);

    // Apply velocity threshold to stop micro-movements
    if (Math.abs(this.velocity.x) < 0.1) this.velocity.x = 0;
    if (Math.abs(this.velocity.y) < 0.1) this.velocity.y = 0;

    this.animation.update();

    switch(this.action) {
      case actions.NONE:
        // MOVE with smooth 360-degree movement
        const newX = this.position.x + this.velocity.x;
        const newY = this.position.y + this.velocity.y;
        
        // Canvas boundaries (800x600 from index.html)
        const minX = 25; // Account for sprite width
        const maxX = 775; // Account for sprite width
        const minY = 25; // Account for sprite height
        const maxY = 575; // Account for sprite height
        
        // Constrain movement within bounds
        this.position.x = Math.max(minX, Math.min(maxX, newX));
        this.position.y = Math.max(minY, Math.min(maxY, newY));

        // TURN based on movement direction
        if (this.velocity.x > 0.5)
          this.facingRight = true;
        else if (this.velocity.x < -0.5)
          this.facingRight = false;
    
        // SET STAND OR RUN ANIMATION based on movement
        const isMoving = Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.y) > 0.1;
        if (!isMoving)
          this.animation = (!this.facingRight) ? this.animations['stand'] : this.animations['standR'];
        else
          this.animation = (!this.facingRight) ? this.animations['run'] : this.animations['runR'];

        // PUNCH
        if (this.input.attack) {
          this.action = actions.ATTACK.PUNCH;
          this.animation = (!this.facingRight) ? this.animations['punch'] : this.animations['punchR'];
          this.animation.reset();
        }
        break;

      case actions.HURT:
        if (this.animation.isDone) {
          this.action = actions.NONE;
          this.animation = (!this.facingRight) ? this.animations['stand'] : this.animations['standR'];
        }
        break;
      
      case actions.ATTACK.PUNCH:
        // Allow movement during attack
        const attackNewX = this.position.x + this.velocity.x;
        const attackNewY = this.position.y + this.velocity.y;
        
        // Canvas boundaries (same as normal movement)
        const attackMinX = 25;
        const attackMaxX = 775;
        const attackMinY = 25;
        const attackMaxY = 575;
        
        // Constrain movement within bounds
        this.position.x = Math.max(attackMinX, Math.min(attackMaxX, attackNewX));
        this.position.y = Math.max(attackMinY, Math.min(attackMaxY, attackNewY));

        // Update facing direction during attack
        if (this.velocity.x > 0.5)
          this.facingRight = true;
        else if (this.velocity.x < -0.5)
          this.facingRight = false;

        // End attack when animation is done
        if (this.animation.isDone) {
          this.action = actions.NONE;
          // Set appropriate animation based on movement
          const isMoving = Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.y) > 0.1;
          if (!isMoving)
            this.animation = (!this.facingRight) ? this.animations['stand'] : this.animations['standR'];
          else
            this.animation = (!this.facingRight) ? this.animations['run'] : this.animations['runR'];
        }
        break;
    }
  }

  setButton(button, value) {
    this.input[button] = value;
  }

  setWallet(walletAddress) {
    this.walletAddress = walletAddress;
    if (walletAddress && walletAddress.length >= 6) {
      this.displayName = `${walletAddress.substring(0, 3)}...${walletAddress.substring(walletAddress.length - 3)}`;
    } else {
      this.displayName = walletAddress || 'Player';
    }
  }

  addKill() {
    this.kills++;
  }

  getKills() {
    return this.kills;
  }

  hurt(damage = 20) {
    if (!this.isAlive) return;
    
    this.health -= damage;
    
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      this.deathTime = Date.now(); // Record death time for cooldown
    }
    
    this.action = actions.HURT;
    this.animation = (!this.facingRight) ? this.animations.hurt : this.animations.hurtR;
    this.animation.reset();
  }

  takeDamage(damage) {
    this.hurt(damage);
  }

  heal(amount) {
    if (!this.isAlive) return;
    this.health = Math.min(this.health + amount, this.maxHealth);
  }

  canRespawn() {
    if (!this.deathTime) return true; // Never died, can respawn
    return Date.now() - this.deathTime >= this.respawnCooldown;
  }

  getRespawnTimeLeft() {
    if (!this.deathTime || this.canRespawn()) return 0;
    return Math.max(0, this.respawnCooldown - (Date.now() - this.deathTime));
  }

  respawn() {
    this.health = this.maxHealth;
    this.isAlive = true;
    this.action = actions.NONE;
    this.animation = (!this.facingRight) ? this.animations['stand'] : this.animations['standR'];
    this.deathTime = null; // Clear death time
    // Reset position to spawn point within bounds
    this.position = {
      x: 100 + Math.random() * 600, // Random x between 100-700
      y: 100 + Math.random() * 400  // Random y between 100-500
    };
  }

  getDrawInfo() {
    return {
      id: this.id,
      position: this.position,
      facingRight: this.facingRight,
      animation: {
        spriteKey: this.animation.spriteKey,
        index: this.animation.getDrawIndex(),
      },
      health: this.health,
      maxHealth: this.maxHealth,
      isAlive: this.isAlive,
      displayName: this.displayName,
      walletAddress: this.walletAddress,
      kills: this.kills,
      canRespawn: this.canRespawn(),
      respawnTimeLeft: this.getRespawnTimeLeft(),
    }
  }
}

module.exports = StickMan;
