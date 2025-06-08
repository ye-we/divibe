let leftKeys = ["a", "s", "d", "f", "q", "w", "e", "z", "x", "c"];
let rightKeys = ["j", "k", "l", ";", "u", "i", "o", "p", "n", "m"];
let currentLeft, currentRight;
let startTime,
  countdown = 25;
let score = 0;
let totalHits = 0;
let gameStarted = false;
let gameEnded = false;
let reactionScore = 0;
let syncScore = 0;
let bpm = 120; // set your track's BPM
let beatInterval;
let lastBeat = 0;
let pulse = 0;
let keyState = {};
let letterAppearTime = 0;
let isPlaying = false;

function preload() {
  sound = loadSound("assets/ATANA - I Can t Stay Forever.mp3");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textAlign(CENTER, CENTER);
  textSize(64);
  frameRate(60);
  // song.play();
  // beatInterval = (60 / bpm) * 1000; // in milliseconds
}

function draw() {
  background(0);
  fill(100);
  rect(10, 10, 80, 40);

  fill(255);
  textSize(20);
  text(isPlaying ? "Pause" : "Play", 50, 30);
  textSize(40);
  if (!gameStarted) {
    fill(255);
    text("DIVIBE\nPress SPACE to start", width / 2, height / 2);
    return;
  }

  if (gameEnded) {
    fill(255);
    text(
      `Time's up!\nScore: ${score}\nPress SPACE to retry`,
      width / 2,
      height / 2
    );
    return;
  }

  let timeLeft = max(0, countdown - int((millis() - startTime) / 1000));
  if (timeLeft <= 0) {
    gameEnded = true;
    return;
  }

  fill(255);
  text(`Time: ${timeLeft}s`, width / 2, 50);
  text(`Score: ${score}`, width / 2, height - 50);
  text(currentLeft, width / 4, height / 2);
  text(currentRight, (3 * width) / 4, height / 2);
}

function keyPressed() {
  if ((!gameStarted && key === " ") || (gameEnded && key === " ")) {
    startGame();
    return;
  }

  if (!currentLeft || !currentRight) return;

  if (!keyState[key]) {
    keyState[key] = millis();
  }

  if (keyState[currentLeft] && keyState[currentRight]) {
    let reaction =
      max(keyState[currentLeft], keyState[currentRight]) - letterAppearTime;
    let offset = abs(keyState[currentLeft] - keyState[currentRight]);
    let reactionScore = scoreReactionTime(reaction);
    let syncScore = scoreSync(offset);
    score += reactionScore + syncScore;
    totalHits++;

    // Reset
    generateKeys();
  }
}

function mousePressed() {
  // Check if mouse is inside the button area
  if (mouseX > 10 && mouseX < 90 && mouseY > 10 && mouseY < 50) {
    isPlaying = !isPlaying; // Toggle state
    if (isPlaying) {
      sound.play();
      // Add your play logic here
    } else {
      sound.pause();
      // Add your pause logic here
    }
  }
}

function generateKeys() {
  keyState = {};
  currentLeft = random(leftKeys);
  currentRight = random(rightKeys);
  letterAppearTime = millis();
}

function startGame() {
  gameEnded = false;
  score = 0;
  totalHits = 0;
  startTime = millis();
  gameStarted = true;
  generateKeys();
}

function scoreReactionTime(ms) {
  // we'll later make this based on the music tempo
  if (ms < 1000) return 80;
  if (ms > 2000) return 0;
  return Math.round(80 - ((ms - 1000) / 1000) * 80);
}

function scoreSync(offset) {
  if (offset < 30) return 20;
  if (offset > 100) return 0;
  return Math.round(20 - ((offset - 30) / 70) * 20);
}

function toggleSound() {
  if (sound.isPlaying()) {
    sound.stop();
  } else {
    sound.play();
  }
}
