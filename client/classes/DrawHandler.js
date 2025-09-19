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