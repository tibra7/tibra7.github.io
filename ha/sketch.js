// --- Global Variables ---
let player;
let bullets = [];
let obstacles = [];
let stars = []; // For parallax background effect
let score = 0;
let gameState = 'START'; // START, PLAYING, GAME_OVER
let scrollSpeed = 3;
let baseScrollSpeed = 3;
let lastObstacleFrame = 0;
let obstacleSpawnInterval = 90; // Frames between potential spawns
let lastShotFrame = 0;
let fireRate = 15; // Minimum frames between shots

// --- Player Object ---
function createPlayer() {
  return {
    x: 100,
    y: windowHeight / 2,
    w: 40, // Width
    h: 20, // Height
    speed: 5,
    draw: function() {
      fill(200, 200, 220); // Light grey for Harrier body
      noStroke();
      // Body
      rect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
      // Cockpit
      fill(50, 50, 100); // Dark blue
      rect(this.x + this.w / 4, this.y - this.h / 4, this.w / 4, this.h / 2);
      // Tail fin
      fill(200, 200, 220);
      triangle(
        this.x - this.w / 2, this.y - this.h / 2,
        this.x - this.w / 2, this.y,
        this.x - this.w / 2 - 10, this.y - this.h / 2
      );
       // Wing (simple representation)
       rect(this.x - this.w/3, this.y - this.h/2 - 5, this.w/2, 5);
       rect(this.x - this.w/3, this.y + this.h/2, this.w/2, 5);
    },
    move: function() {
      if ((keyIsDown(UP_ARROW) || keyIsDown(87)) && this.y > this.h / 2 + 10) { // W key
        this.y -= this.speed;
      }
      if ((keyIsDown(DOWN_ARROW) || keyIsDown(83)) && this.y < windowHeight - this.h / 2 - 10) { // S key
        this.y += this.speed;
      }
    },
    shoot: function() {
        // Check fire rate limit
        if (frameCount - lastShotFrame < fireRate) {
            return;
        }
        lastShotFrame = frameCount;

        bullets.push({
            x: this.x + this.w / 2,
            y: this.y,
            size: 8,
            speed: 10,
            draw: function() {
                fill(255, 100, 0); // Orange bullet
                noStroke();
                ellipse(this.x, this.y, this.size, this.size / 1.5);
            },
            update: function() {
                this.x += this.speed;
            }
        });
    }
  };
}

// --- Obstacle Object ---
function createObstacle() {
    const type = random(['ENEMY_JET', 'MISSILE']);
    const obsY = random(50, windowHeight - 50);
    const obsSpeed = scrollSpeed * random(0.8, 1.5); // Vary speeds a bit

    if (type === 'ENEMY_JET') {
        return {
            x: windowWidth + 50,
            y: obsY,
            w: 35,
            h: 15,
            speed: obsSpeed,
            type: type,
            points: 50, // Score for destroying
            draw: function() {
                fill(180, 0, 0); // Red enemy
                noStroke();
                 // Body
                rect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
                // Tail fin (opposite direction)
                triangle(
                    this.x + this.w / 2, this.y - this.h / 2,
                    this.x + this.w / 2, this.y,
                    this.x + this.w / 2 + 10, this.y - this.h / 2
                );
            },
            update: function() {
                this.x -= this.speed;
            }
        };
    } else { // MISSILE type
         return {
            x: windowWidth + 30,
            y: obsY,
            w: 25,
            h: 8,
            speed: obsSpeed * 1.2, // Missiles are faster
            type: type,
            points: 20, // Score for destroying
            draw: function() {
                fill(50, 50, 50); // Dark grey missile
                noStroke();
                // Body
                rect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
                // Nose cone
                fill(255, 0, 0); // Red tip
                 triangle(
                    this.x + this.w / 2, this.y - this.h / 2,
                    this.x + this.w / 2, this.y + this.h / 2,
                    this.x + this.w / 2 + 10, this.y
                );
                // Tiny flame trail
                fill(255, 165, 0); // Orange
                ellipse(this.x - this.w / 2 - 5, this.y, 8, 6);
            },
            update: function() {
                this.x -= this.speed;
            }
        };
    }
}

// --- Star Object for Background ---
function createStar() {
    return {
        x: random(windowWidth),
        y: random(windowHeight),
        size: random(1, 3),
        speed: random(0.1, 0.5) * scrollSpeed // Slower speed for parallax
    };
}


// --- p5.js Setup Function ---
function setup() {
  createCanvas(windowWidth, windowHeight);
  player = createPlayer();
  textAlign(CENTER, CENTER);
  textSize(20);
  textFont('monospace'); // Retro feel

  // Initialize stars
  for (let i = 0; i < 100; i++) {
    stars.push(createStar());
  }
  noStroke(); // Default no outlines
}

// --- p5.js Draw Function (Game Loop) ---
function draw() {
  // Background color (dark blue night sky)
  background(0, 0, 30);

  // Draw stars (parallax effect)
  drawStars();

  if (gameState === 'START') {
    displayStartScreen();
  } else if (gameState === 'PLAYING') {
    runGame();
  } else if (gameState === 'GAME_OVER') {
    displayGameOverScreen();
  }
}

// --- Game State Functions ---

function runGame() {
  // --- Update ---
  player.move();
  updateObstacles();
  updateBullets();
  spawnObstacles();
  checkCollisions();

  // Increase difficulty over time
  scrollSpeed = baseScrollSpeed + score / 2000; // Gradually increase speed
  obstacleSpawnInterval = max(30, 90 - score / 500); // Spawn faster over time


  // --- Draw ---
  player.draw();
  drawObstacles();
  drawBullets();
  displayScore();
  displayHUDInstructions(); // Show controls during gameplay
}

function displayStartScreen() {
  fill(255);
  textSize(48);
  text("8-Bit Harrier Runner", windowWidth / 2, windowHeight / 2 - 100);

  textSize(24);
  text("Instructions:", windowWidth / 2, windowHeight / 2);
  text("UP/DOWN Arrows or W/S: Move Jet", windowWidth / 2, windowHeight / 2 + 40);
  text("SPACEBAR: Shoot", windowWidth / 2, windowHeight / 2 + 70);
  text("Avoid or shoot enemies!", windowWidth / 2, windowHeight / 2 + 100);

  textSize(28);
  text("Press SPACEBAR to Start", windowWidth / 2, windowHeight / 2 + 160);
}

function displayGameOverScreen() {
  fill(255, 0, 0); // Red text
  textSize(60);
  text("GAME OVER", windowWidth / 2, windowHeight / 2 - 50);

  fill(255); // White text
  textSize(32);
  text(`Final Score: ${score}`, windowWidth / 2, windowHeight / 2 + 20);

  textSize(24);
  text("Press SPACEBAR to Restart", windowWidth / 2, windowHeight / 2 + 80);

  // Draw obstacles and player one last time (frozen)
  player.draw();
  drawObstacles();
  drawBullets();
  drawStars(false); // Draw stars without updating
}

function displayScore() {
  fill(255);
  textSize(24);
  textAlign(LEFT, TOP);
  text(`Score: ${score}`, 20, 20);
  textAlign(CENTER, CENTER); // Reset alignment
}

function displayHUDInstructions() {
    fill(200, 200, 200, 150); // Semi-transparent white
    textSize(16);
    textAlign(RIGHT, TOP);
    text("Move: W/S or ↑/↓", windowWidth - 20, 20);
    text("Shoot: SPACE", windowWidth - 20, 45);
    textAlign(CENTER, CENTER); // Reset alignment
}

// --- Update and Draw Helpers ---

function drawStars(update = true) {
  fill(255); // White stars
  for (let i = stars.length - 1; i >= 0; i--) {
    let star = stars[i];
    ellipse(star.x, star.y, star.size, star.size);
    if (update) {
        star.x -= star.speed;
        if (star.x < -star.size) {
            // Reset star position when it goes off-screen
            star.x = windowWidth + star.size;
            star.y = random(windowHeight);
        }
    }
  }
}


function updateObstacles() {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].update();
    // Remove obstacles that go off-screen left
    if (obstacles[i].x < -obstacles[i].w) {
      obstacles.splice(i, 1);
      // Small score bonus for surviving past an obstacle
      if (gameState === 'PLAYING') {
          score += 5;
      }
    }
  }
}

function drawObstacles() {
  for (let obs of obstacles) {
    obs.draw();
  }
}

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].update();
    // Remove bullets that go off-screen right
    if (bullets[i].x > windowWidth + bullets[i].size) {
      bullets.splice(i, 1);
    }
  }
}

function drawBullets() {
  for (let bullet of bullets) {
    bullet.draw();
  }
}

function spawnObstacles() {
  // Check if enough time has passed since the last spawn attempt
  if (frameCount - lastObstacleFrame > obstacleSpawnInterval) {
    // Add a random chance to spawn, not guaranteed every interval
    if (random(1) < 0.6) { // 60% chance to spawn an obstacle
       obstacles.push(createObstacle());
    }
    lastObstacleFrame = frameCount; // Reset the timer regardless of spawn success
  }
}

// --- Collision Detection ---
function checkCollisions() {
  // 1. Player vs Obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    let obs = obstacles[i];
    // Simple rectangle overlap check
    if (
      player.x + player.w / 2 > obs.x - obs.w / 2 &&
      player.x - player.w / 2 < obs.x + obs.w / 2 &&
      player.y + player.h / 2 > obs.y - obs.h / 2 &&
      player.y - player.h / 2 < obs.y + obs.h / 2
    ) {
      gameOver();
      return; // Stop checking collisions if game over
    }
  }

  // 2. Bullets vs Obstacles
  for (let i = bullets.length - 1; i >= 0; i--) {
    let bullet = bullets[i];
    for (let j = obstacles.length - 1; j >= 0; j--) {
      let obs = obstacles[j];
      // Simple distance check (treat bullet as point, obstacle has hitbox)
      if (dist(bullet.x, bullet.y, obs.x, obs.y) < max(obs.w / 2, obs.h/2) + bullet.size / 2) {
          score += obs.points; // Add score for hitting
          obstacles.splice(j, 1); // Remove hit obstacle
          bullets.splice(i, 1);   // Remove the bullet
          break; // Stop checking this bullet against other obstacles
      }
    }
  }
}

// --- Game State Management ---

function gameOver() {
  gameState = 'GAME_OVER';
  // You could add explosion effects here
}

function resetGame() {
  player = createPlayer();
  bullets = [];
  obstacles = [];
  score = 0;
  scrollSpeed = baseScrollSpeed;
  lastObstacleFrame = frameCount; // Reset spawn timer relative to current frame
  gameState = 'PLAYING';
}

// --- Input Handling ---
function keyPressed() {
  if (keyCode === 32) { // Spacebar
    if (gameState === 'PLAYING') {
      player.shoot();
    } else if (gameState === 'START' || gameState === 'GAME_OVER') {
      resetGame();
    }
  }
}

// --- Handle Window Resizing ---
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // Adjust player starting position if needed, or maybe reset?
  // For simplicity, we might just let it be, or reset the game on resize.
  // Resetting might be easiest:
   if (gameState === 'PLAYING') {
       gameOver(); // End current game if resized during play
       // Optional: You could try to reposition player: player.y = constrain(player.y, player.h / 2 + 10, windowHeight - player.h / 2 - 10);
   } else if(gameState === 'START') {
       // No action needed, start screen will recenter
   } else if (gameState === 'GAME_OVER') {
        // No action needed, game over screen will recenter
   }

   // Reset star positions for new size
   stars = [];
   for (let i = 0; i < 100; i++) {
        stars.push(createStar());
   }
}
