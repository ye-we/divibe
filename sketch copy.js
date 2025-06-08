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
let keyState = {};
let letterAppearTime = 0;
let isPlaying = false;
let tempo = 1;
let dragging = false;
let fft;
let bassLevel, midLevel, highLevel;
let lastBeatTime = 0;
let beatInterval = 500; // Initial beat interval in ms
let letterInterval = 4; // Letters appear every 4 beats
let currentBeatCount = 0; // Track current beat position
let targetBeat = -1; // The beat number we need to hit (1-4)
let hasSetTargetBeat = false; // Whether we've set the target beat yet

function preload() {
  sound = loadSound("assets/ATANA - I Can t Stay Forever.mp3");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textAlign(CENTER, CENTER);
  textSize(64);
  frameRate(60);
  amplitude = new p5.Amplitude();

  // Initialize FFT
  fft = new p5.FFT();
  fft.setInput(sound);
}

function draw() {
  background(0);

  // Get frequency data
  let spectrum = fft.analyze();

  // Calculate levels for different frequency bands
  bassLevel = fft.getEnergy("bass");
  midLevel = fft.getEnergy("mid");
  highLevel = fft.getEnergy("treble");

  // Draw frequency bands
  drawFrequencyBands();

  // Draw game elements
  fill(100);
  rect(10, 10, 80, 40);

  fill(255);
  textSize(20);
  text(isPlaying ? "Pause" : "Play", 50, 30);
  textSize(40);

  // Draw tempo slider
  const sliderX = 100;
  const sliderY = height - 80;
  const sliderWidth = 300;
  const sliderHeight = 20;

  fill(100);
  rect(sliderX, sliderY, sliderWidth, sliderHeight, 10);

  const minTempo = 0.5;
  const maxTempo = 2;
  const knobX = map(tempo, minTempo, maxTempo, sliderX, sliderX + sliderWidth);

  fill(255);
  ellipse(knobX, sliderY + sliderHeight / 2, 30, 30);

  fill(255);
  textSize(16);
  textAlign(LEFT);
  text(`Tempo: ${tempo.toFixed(2)}x`, sliderX, sliderY - 10);
  fill(0);

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

  // Beat detection
  if (isPlaying && gameStarted) {
    let currentTime = millis();

    // Check if it's time for a new beat
    if (currentTime - lastBeatTime >= beatInterval) {
      currentBeatCount = (currentBeatCount + 1) % letterInterval;
      lastBeatTime = currentTime;
    }
  }

  fill(255);
  text(`Time: ${timeLeft}s`, width / 2, 50);
  text(`Score: ${score}`, width / 2, height - 50);

  // Show letters if we have them
  if (currentLeft && currentRight) {
    text(currentLeft, width / 2 - 60, height / 2);
    text(currentRight, width / 2 + 60, height / 2);
  }

  // Draw visual beat display
  drawBeatDisplay();
}

function drawFrequencyBands() {
  // Draw bass visualization (kicks)
  fill(255, 0, 0, 150);
  let bassHeight = map(bassLevel, 0, 255, 0, height / 3);
  rect(0, height - bassHeight, width / 3, bassHeight);

  // Draw mid visualization (vocals)
  fill(0, 255, 0, 150);
  let midHeight = map(midLevel, 0, 255, 0, height / 3);
  rect(width / 3, height - midHeight, width / 3, midHeight);

  // Draw high visualization (hi-hats)
  fill(0, 0, 255, 150);
  let highHeight = map(highLevel, 0, 255, 0, height / 3);
  rect((2 * width) / 3, height - highHeight, width / 3, highHeight);

  // Add labels
  fill(255);
  textSize(16);
  textAlign(CENTER);
  text("Bass/Kicks", width / 6, height - 20);
  text("Vocals", width / 2, height - 20);
  text("Hi-hats", (5 * width) / 6, height - 20);
}

function drawBeatDisplay() {
  const beatDisplayY = height / 2 + 80;
  const beatSize = 40;
  const beatSpacing = 60;
  const startX = width / 2 - beatSpacing * 1.5;

  textAlign(CENTER, CENTER);
  textSize(20);

  // Draw all beats
  for (let i = 0; i < letterInterval; i++) {
    const x = startX + i * beatSpacing;

    // Draw beat circle
    if (i === currentBeatCount) {
      // Current beat - highlighted
      fill(255, 255, 0);
      ellipse(x, beatDisplayY, beatSize, beatSize);
    } else {
      // Other beats
      fill(100);
      ellipse(x, beatDisplayY, beatSize, beatSize);
    }

    // Draw beat number
    fill(0);
    text(i + 1, x, beatDisplayY);

    // Draw target beat indicator if set
    if (hasSetTargetBeat && i === targetBeat) {
      noFill();
      stroke(255, 0, 0);
      strokeWeight(3);
      ellipse(x, beatDisplayY, beatSize + 10, beatSize + 10);
      noStroke();
    }
  }

  // Reset text alignment
  textAlign(CENTER, CENTER);
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
    // If we haven't set the target beat yet, set it now
    if (!hasSetTargetBeat) {
      targetBeat = currentBeatCount;
      hasSetTargetBeat = true;
      let reaction =
        max(keyState[currentLeft], keyState[currentRight]) - letterAppearTime;
      let offset = abs(keyState[currentLeft] - keyState[currentRight]);
      let reactionScore = scoreReactionTime(reaction);
      let syncScore = scoreSync(offset);
      score += reactionScore + syncScore;
      totalHits++;
      generateKeys();
    }
    // If we have set the target beat, only score on that beat
    else if (currentBeatCount === targetBeat) {
      let reaction =
        max(keyState[currentLeft], keyState[currentRight]) - letterAppearTime;
      let offset = abs(keyState[currentLeft] - keyState[currentRight]);
      let reactionScore = scoreReactionTime(reaction);
      let syncScore = scoreSync(offset);
      score += reactionScore + syncScore;
      totalHits++;
      generateKeys();
    }
    // Reset key state regardless
    keyState = {};
  }
}

function mousePressed() {
  dragging = true;

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

function mouseReleased() {
  dragging = false;
}

function mouseDragged() {
  if (dragging) {
    const sliderX = 100;
    const sliderWidth = 300;
    const minTempo = 0.5;
    const maxTempo = 2;
    const clampedX = constrain(mouseX, sliderX, sliderX + sliderWidth);
    tempo = map(clampedX, sliderX, sliderX + sliderWidth, minTempo, maxTempo);
    sound.rate(tempo);
    // Update beat interval based on tempo
    beatInterval = 500 / tempo; // Base interval of 500ms adjusted by tempo
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
  currentBeatCount = 0;
  hasSetTargetBeat = false;
  targetBeat = -1;
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
