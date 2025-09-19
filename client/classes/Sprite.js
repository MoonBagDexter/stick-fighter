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