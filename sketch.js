let leftKeys = ["a", "s", "d", "f", "q", "w", "e", "z", "x", "c"];
let rightKeys = ["j", "k", "l", ";", "u", "i", "o", "p", "n", "m"];
let currentLeft, currentRight;
let startTime,
  countdown = 50;
let score = 0;
let highScore = 0;
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
let baseBeatInterval = 60000 / 128; // Fixed 128 BPM
let beatInterval = baseBeatInterval;
let letterInterval = 4;
let currentBeatCount = 0;
let targetBeat = -1;
let hasSetTargetBeat = false;
let isPaused = false;
let beatsSinceLastScore = 0;
let missedBeatsInBar = 0; // Track missed beats in current bar
let lastBeatHit = false; // Track if the last beat was hit
let pixelFont;
let sound;
let fileInput;
let detectedBPM = 128; // Fixed BPM
let energyHistory = [];
let lastPeakTime = 0;
let peakThreshold = 0.15;
let minPeakDistance = 200;
let minBPM = 60;
let maxBPM = 180;
let bpmHistory = [];
let bpmHistorySize = 5;
let defaultOscillator;
let defaultGain;
let defaultBPM = 120;
let isLoading = true;
let targetBeatsPerCycle = 2; // Number of target beats per 4-beat cycle
let targetBeatPositions = [0, 2]; // Array to store which beats are targets
let targetBeatInput;
let lastInputValue = "";

function preload() {
  // Load high score from localStorage
  highScore = parseInt(localStorage.getItem("divibeHighScore")) || 0;
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textAlign(CENTER, CENTER);
  textFont("monospace");
  frameRate(60);
  amplitude = new p5.Amplitude();

  // Create file input
  fileInput = createFileInput(handleFile);
  fileInput.position(width - 320, 30);
  fileInput.style("color", "white");
  fileInput.style("background-color", "#333");
  fileInput.style("border", "2px solid #666");
  fileInput.style("border-radius", "5px");
  fileInput.style("padding", "5px");

  // Create target beat input
  targetBeatInput = createInput("0,2", "text");
  targetBeatInput.position(width - 320, 160);
  targetBeatInput.size(100, 20);
  targetBeatInput.style("color", "white");
  targetBeatInput.style("background-color", "#333");
  targetBeatInput.style("border", "2px solid #666");
  targetBeatInput.style("border-radius", "5px");
  targetBeatInput.style("padding", "5px");
  targetBeatInput.input(updateTargetBeatPositionsFromInput);

  // Initialize FFT
  fft = new p5.FFT();

  // Load default atana track
  try {
    sound = loadSound(
      "assets/ATANA - I Can t Stay Forever.mp3",
      () => {
        console.log("Default track loaded successfully");
        fft.setInput(sound);
        isLoading = false;
      },
      (err) => {
        console.error("Error loading default track:", err);
        isLoading = false;
      }
    );
  } catch (error) {
    console.error("Failed to load sound:", error);
    isLoading = false;
  }
}

function createDefaultAudio() {
  // Create oscillator for the beat
  defaultOscillator = new p5.Oscillator("sine");
  defaultGain = new p5.Gain();

  // Set up the audio chain
  defaultOscillator.disconnect();
  defaultGain.disconnect();
  defaultOscillator.connect(defaultGain);
  defaultGain.connect();

  // Set initial values
  defaultOscillator.freq(220); // A3 note
  defaultGain.amp(0);

  // Set the default BPM
  detectedBPM = defaultBPM;
  baseBeatInterval = 60000 / defaultBPM;
  beatInterval = baseBeatInterval / tempo;

  // Connect to FFT
  fft.setInput(defaultGain);
}

function startDefaultBeat() {
  if (!defaultOscillator) {
    createDefaultAudio();
  }

  defaultOscillator.start();
  defaultGain.amp(0.3);

  // Create a simple beat pattern
  let beatPattern = [1, 0, 1, 0]; // Strong, weak, strong, weak
  let currentBeat = 0;
  let lastBeatTime = millis();

  function playBeat() {
    if (!isPlaying || isPaused) {
      defaultGain.amp(0);
      return;
    }

    let currentTime = millis();
    let timeSinceLastBeat = currentTime - lastBeatTime;

    if (timeSinceLastBeat >= beatInterval) {
      let amplitude = beatPattern[currentBeat] * 0.3;
      defaultGain.amp(amplitude, 0.05);

      currentBeat = (currentBeat + 1) % beatPattern.length;
      lastBeatTime = currentTime;
    }

    // Schedule next frame
    requestAnimationFrame(playBeat);
  }

  playBeat();
}

function handleFile(file) {
  if (file.type === "audio") {
    if (sound) {
      sound.stop();
    }

    sound = loadSound(file.data, () => {
      console.log("New audio file loaded");
      fft.setInput(sound);

      if (gameStarted) {
        startGame();
      }
    });
  } else {
    console.log("Please select an audio file");
  }
}

function detectBPM() {
  // Reset detection variables
  energyHistory = [];
  lastPeakTime = 0;
  detectedBPM = 0;
  bpmHistory = [];

  // Start analyzing the audio
  sound.play();
  sound.pause();

  // Analyze first 10 seconds of the song for better accuracy
  let analysisStartTime = millis();
  let analysisDuration = 10000; // 10 seconds

  function analyzeAudio() {
    if (millis() - analysisStartTime < analysisDuration) {
      let spectrum = fft.analyze();
      let energy = fft.getEnergy("bass");
      energyHistory.push(energy);

      // Look for peaks in the bass energy
      if (energyHistory.length > 1) {
        let prevEnergy = energyHistory[energyHistory.length - 2];
        let currentEnergy = energyHistory[energyHistory.length - 1];

        // If we detect a peak and enough time has passed
        if (
          currentEnergy > peakThreshold &&
          currentEnergy > prevEnergy &&
          millis() - lastPeakTime > minPeakDistance
        ) {
          lastPeakTime = millis();
        }
      }

      requestAnimationFrame(analyzeAudio);
    } else {
      // Calculate BPM from the peaks
      let peakCount = energyHistory.filter((energy, i) => {
        if (i === 0) return false;
        return energy > peakThreshold && energy > energyHistory[i - 1];
      }).length;

      // Calculate raw BPM
      let rawBPM = (peakCount / (analysisDuration / 1000)) * 60;

      // Add to history and maintain size
      bpmHistory.push(rawBPM);
      if (bpmHistory.length > bpmHistorySize) {
        bpmHistory.shift();
      }

      // Calculate average BPM
      let avgBPM = bpmHistory.reduce((a, b) => a + b, 0) / bpmHistory.length;

      // Constrain BPM to reasonable range
      detectedBPM = constrain(avgBPM, minBPM, maxBPM);
      console.log("Detected BPM:", detectedBPM);

      // Set base beat interval based on BPM
      baseBeatInterval = 60000 / detectedBPM; // Convert BPM to milliseconds
      beatInterval = baseBeatInterval / tempo;

      // Reset the audio
      sound.stop();
    }
  }

  analyzeAudio();
}

function draw() {
  background(0);

  if (isLoading) {
    drawLoadingScreen();
    return;
  }

  // Get frequency data
  let spectrum = fft.analyze();

  // Calculate levels for different frequency bands
  bassLevel = fft.getEnergy("bass");
  midLevel = fft.getEnergy("mid");
  highLevel = fft.getEnergy("treble");

  // Draw frequency bands
  drawFrequencyBands();
  drawTempoSlider();

  if (!gameStarted) {
    drawTitleScreen();
    return;
  }

  if (gameEnded) {
    drawGameOver();
    return;
  }

  if (isPaused) {
    drawPauseScreen();
    return;
  }

  let timeLeft = max(0, countdown - int((millis() - startTime) / 1000));
  if (timeLeft <= 0) {
    endGame();
    return;
  }

  // Beat detection
  if (isPlaying && gameStarted && !isPaused) {
    let currentTime = millis();

    // Check if it's time for a new beat
    if (currentTime - lastBeatTime >= beatInterval) {
      currentBeatCount = (currentBeatCount + 1) % letterInterval;
      lastBeatTime = currentTime;

      // If we have a target beat set and have some score
      if (hasSetTargetBeat && score > 0) {
        beatsSinceLastScore++;

        // If we've gone 5 beats without scoring
        if (beatsSinceLastScore >= 5) {
          score = max(0, score - 10); // Deduct 10 points
          console.log("Deducted 10 points - no score in 5 beats");
          beatsSinceLastScore = 0; // Reset the counter
        }
      }
    }
  }

  drawScore(timeLeft);
  drawLetters();
  drawBeatDisplay();
}

function drawLoadingScreen() {
  fill(255);
  textSize(32);
  textAlign(CENTER, CENTER);
  text("LOADING", width / 2, height / 2);

  // Draw loading animation
  let loadingDots = "..." + ".".repeat(floor(millis() / 500) % 4);
  textSize(24);
  text(loadingDots, width / 2, height / 2 + 40);

  // Add debug info
  textSize(12);
  textAlign(LEFT);
  text(`Sound loaded: ${sound ? "Yes" : "No"}`, 20, height - 60);
  text(`FFT initialized: ${fft ? "Yes" : "No"}`, 20, height - 40);
  text(`Loading state: ${isLoading}`, 20, height - 20);
  textAlign(CENTER);
}

function drawTitleScreen() {
  fill(255);
  textSize(32);
  text("DIVIBE", width / 2, height / 2 - 50);

  // Display high score
  fill(255, 215, 0); // Gold color for high score
  textSize(24);
  text(`HIGH SCORE: ${highScore}`, width / 2, height / 2);

  fill(255);
  textSize(16);
  text("Press SPACE to start", width / 2, height / 2 + 50);

  // Add file input instructions
  fill(200);
  textSize(14);
  text(
    "Upload your own music file to play with different songs!",
    width / 2,
    height / 2 + 80
  );
}

function drawGameOver() {
  fill(255);
  textSize(32);
  text("GAME OVER", width / 2, height / 2 - 50);
  textSize(24);
  text(`Score: ${score}`, width / 2, height / 2);
  if (score > highScore) {
    fill(255, 215, 0); // Gold color for new high score
    textSize(20);
    text("NEW HIGH SCORE!", width / 2, height / 2 + 30);
  }
  fill(255);
  textSize(16);
  text("Press SPACE to retry", width / 2, height / 2 + 60);
}

function drawPauseScreen() {
  fill(255);
  textSize(32);
  text("PAUSED", width / 2, height / 2 - 50);
  textSize(16);
  text("Press SPACE to resume", width / 2, height / 2 + 50);
}

function drawTempoSlider() {
  const sliderX = width - 320;
  const sliderY = 100; // Moved down from 80 to 120
  const sliderWidth = 300;
  const sliderHeight = 20;

  // Tempo level display first
  fill(255);
  textSize(12);
  textAlign(LEFT);
  text(
    `TEMPO: ${tempo.toFixed(2)}x (${(detectedBPM * tempo).toFixed(0)} BPM)`,
    sliderX,
    sliderY - 15
  );

  // Slider track
  fill(50);
  rect(sliderX, sliderY, sliderWidth, sliderHeight, 10);

  const minTempo = 0.5;
  const maxTempo = 3;
  const knobX = map(tempo, minTempo, maxTempo, sliderX, sliderX + sliderWidth);

  // Knob glow
  for (let i = 0; i < 3; i++) {
    noFill();
    stroke(100, 100, 255, 50 - i * 15);
    strokeWeight(3 - i);
    ellipse(knobX, sliderY + sliderHeight / 2, 30 + i * 5, 30 + i * 5);
  }

  // Knob
  fill(255);
  ellipse(knobX, sliderY + sliderHeight / 2, 30, 30);

  // Target beats label
  textSize(12);
  textAlign(LEFT);
  text("Target Beats (0-3, comma-separated):", sliderX, sliderY + 45);

  textAlign(CENTER);
}

function drawScore(timeLeft) {
  // Time display
  fill(255);
  textSize(16);
  text(`TIME: ${timeLeft}s`, width / 2, 50);

  // Score display with glow (moved to top left)
  for (let i = 0; i < 3; i++) {
    fill(100, 100, 255, 50 - i * 15);
    textSize(24 + i * 2);
    text(`SCORE: ${score}`, 100, 30);
  }
  fill(255);
  textSize(24);
  text(`SCORE: ${score}`, 100, 30);

  // High score display
  fill(255, 215, 0); // Gold color for high score
  textSize(16);
  text(`HIGH SCORE: ${highScore}`, 100, 60);
}

function drawLetters() {
  if (currentLeft && currentRight) {
    // Letter glow effect
    for (let i = 0; i < 3; i++) {
      fill(100, 100, 255, 50 - i * 15);
      textSize(64 + i * 4);
      text(currentLeft, width / 2 - 60, height / 2);
      text(currentRight, width / 2 + 60, height / 2);
    }

    // Main letters
    fill(255);
    textSize(64);
    text(currentLeft, width / 2 - 60, height / 2);
    text(currentRight, width / 2 + 60, height / 2);
  }
}

function drawBeatDisplay() {
  const beatDisplayY = height / 2 + 80;
  const beatSize = 40;
  const beatSpacing = 60;
  const startX = width / 2 - beatSpacing * 1.5;

  textAlign(CENTER, CENTER);
  textSize(16);

  // Draw all beats
  for (let i = 0; i < letterInterval; i++) {
    const x = startX + i * beatSpacing;

    // Beat circle glow
    for (let j = 0; j < 3; j++) {
      noFill();
      if (i === currentBeatCount) {
        stroke(255, 255, 0, 50 - j * 15);
      } else {
        stroke(100, 100, 255, 50 - j * 15);
      }
      strokeWeight(3 - j);
      ellipse(x, beatDisplayY, beatSize + j * 5, beatSize + j * 5);
    }

    // Draw beat circle
    if (i === currentBeatCount) {
      fill(255, 255, 0);
    } else {
      fill(100);
    }
    ellipse(x, beatDisplayY, beatSize, beatSize);

    // Draw beat number
    fill(0);
    text(i + 1, x, beatDisplayY);

    // Draw target beat indicator
    if (targetBeatPositions.includes(i)) {
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

function drawFrequencyBands() {
  const bandHeight = height / 4;
  const bandWidth = width / 4;
  const centerY = height - bandHeight / 2;

  // Draw kicks visualization (very low frequencies)
  let kickLevel = fft.getEnergy(20, 60);
  drawFrequencyWave(bandWidth / 2, centerY, kickLevel, [255, 0, 0]);

  // Draw bass visualization (low frequencies)
  let bassLevel = fft.getEnergy(60, 250);
  drawFrequencyWave(bandWidth * 1.5, centerY, bassLevel, [255, 100, 0]);

  // Draw mid visualization (vocals)
  let midLevel = fft.getEnergy(250, 2000);
  drawFrequencyWave(bandWidth * 2.5, centerY, midLevel, [0, 255, 0]);

  // Draw high visualization (hi-hats)
  let highLevel = fft.getEnergy(2000, 4000);
  drawFrequencyWave(bandWidth * 3.5, centerY, highLevel, [0, 0, 255]);

  // Add labels
  textAlign(CENTER);
  textSize(16);
  fill(255);
  text("Kicks", bandWidth / 2, height - 20);
  text("Bass", bandWidth * 1.5, height - 20);
  text("Vocals", bandWidth * 2.5, height - 20);
  text("Hi-hats", bandWidth * 3.5, height - 20);
  textAlign(CENTER, CENTER);
}

function drawFrequencyWave(x, y, level, color) {
  push();
  translate(x, y);

  const waveWidth = 100;
  const waveHeight = map(level, 0, 255, 10, 80);
  const time = frameCount * 0.05;

  // Draw multiple layers of waves
  for (let layer = 0; layer < 3; layer++) {
    noFill();
    stroke(color[0], color[1], color[2], 255 - layer * 80);
    strokeWeight(3 - layer);

    beginShape();
    for (let i = 0; i <= waveWidth; i += 2) {
      const x = map(i, 0, waveWidth, -waveWidth / 2, waveWidth / 2);
      const y = sin(time + i * 0.1) * waveHeight * (1 - layer * 0.2);
      vertex(x, y);
    }
    endShape();
  }

  // Add particles for high levels
  if (level > 150) {
    for (let i = 0; i < 5; i++) {
      const x = random(-waveWidth / 2, waveWidth / 2);
      const y = sin(time + x * 0.1) * waveHeight;
      fill(color[0], color[1], color[2], 200);
      noStroke();
      ellipse(x, y, 3, 3);
    }
  }

  pop();
}

function keyPressed() {
  if (key === " ") {
    if (!gameStarted || gameEnded) {
      startGame();
    } else {
      togglePause();
    }
    return;
  }

  if (isPaused || !currentLeft || !currentRight) return;

  if (!keyState[key]) {
    keyState[key] = millis();
  }

  if (keyState[currentLeft] && keyState[currentRight]) {
    // If we haven't set the target beat yet, set it now
    if (!hasSetTargetBeat) {
      hasSetTargetBeat = true;
      let reaction =
        max(keyState[currentLeft], keyState[currentRight]) - letterAppearTime;
      let offset = abs(keyState[currentLeft] - keyState[currentRight]);
      let reactionScore = scoreReactionTime(reaction);
      let syncScore = scoreSync(offset);
      score += reactionScore + syncScore;
      totalHits++;
      generateKeys();
      beatsSinceLastScore = 0;
    }
    // If we have set the target beat, only score on target beats
    else if (targetBeatPositions.includes(currentBeatCount)) {
      let reaction =
        max(keyState[currentLeft], keyState[currentRight]) - letterAppearTime;
      let offset = abs(keyState[currentLeft] - keyState[currentRight]);
      let reactionScore = scoreReactionTime(reaction);
      let syncScore = scoreSync(offset);
      score += reactionScore + syncScore;
      totalHits++;
      generateKeys();
      beatsSinceLastScore = 0;
    }
    // Reset key state regardless
    keyState = {};
  }
}

function mousePressed() {
  // Check if mouse is inside the slider area
  const sliderX = width - 320;
  const sliderY = 120; // Updated to match new position
  const sliderWidth = 300;
  const sliderHeight = 20;

  if (
    mouseX >= sliderX &&
    mouseX <= sliderX + sliderWidth &&
    mouseY >= sliderY - 15 &&
    mouseY <= sliderY + sliderHeight + 15
  ) {
    dragging = true;
    updateTempoFromMouse();
  }

  // Check target beats buttons
  const buttonWidth = 40;
  const buttonHeight = 20;
  const buttonSpacing = 10;

  // Button 1
  if (
    mouseX >= sliderX &&
    mouseX <= sliderX + buttonWidth &&
    mouseY >= sliderY + 50 &&
    mouseY <= sliderY + 50 + buttonHeight
  ) {
    targetBeatsPerCycle = 1;
    updateTargetBeatPositions();
    hasSetTargetBeat = false; // Reset target beat state when changing mode
  }

  // Button 2
  if (
    mouseX >= sliderX + buttonWidth + buttonSpacing &&
    mouseX <= sliderX + buttonWidth * 2 + buttonSpacing &&
    mouseY >= sliderY + 50 &&
    mouseY <= sliderY + 50 + buttonHeight
  ) {
    targetBeatsPerCycle = 2;
    updateTargetBeatPositions();
    hasSetTargetBeat = false; // Reset target beat state when changing mode
  }
}

function mouseReleased() {
  dragging = false;
}

function mouseDragged() {
  if (dragging) {
    updateTempoFromMouse();
  }
}

function updateTempoFromMouse() {
  const sliderX = width - 320;
  const sliderWidth = 300;
  const minTempo = 0.5;
  const maxTempo = 3;

  const clampedX = constrain(mouseX, sliderX, sliderX + sliderWidth);
  const newTempo = map(
    clampedX,
    sliderX,
    sliderX + sliderWidth,
    minTempo,
    maxTempo
  );
  const smoothedTempo = lerp(tempo, newTempo, 0.3);

  if (abs(smoothedTempo - tempo) > 0.01) {
    tempo = smoothedTempo;
    sound.rate(tempo);
    beatInterval = baseBeatInterval / tempo;
  }
}

function togglePause() {
  isPaused = !isPaused;
  if (isPaused) {
    if (sound && sound.isLoaded()) {
      sound.pause();
    }
    if (defaultOscillator) {
      defaultGain.amp(0);
    }
  } else {
    if (sound && sound.isLoaded()) {
      sound.play();
    } else {
      startDefaultBeat();
    }
    lastBeatTime = millis();
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
  isPaused = false;
  isPlaying = true;
  currentBeatCount = 0;
  lastBeatTime = millis();
  hasSetTargetBeat = false;
  targetBeat = -1;
  beatsSinceLastScore = 0;
  beatInterval = baseBeatInterval / tempo;
  updateTargetBeatPositions(); // Initialize target beat positions
  generateKeys();

  // Start either the music or default beat
  if (sound && sound.isLoaded()) {
    sound.play();
  } else {
    startDefaultBeat();
  }
}

function scoreReactionTime(ms) {
  // Score based on how close to the target beat
  if (ms < 200) return 100; // Perfect timing
  if (ms < 400) return 50; // Good timing
  if (ms < 600) return 25; // Okay timing
  return 0; // Too late
}

function scoreSync(offset) {
  // Score based on how well the two keys were pressed together
  if (offset < 50) return 50; // Perfect sync
  if (offset < 100) return 25; // Good sync
  if (offset < 150) return 10; // Okay sync
  return 0; // Poor sync
}

function toggleSound() {
  if (sound.isPlaying()) {
    sound.stop();
  } else {
    sound.play();
  }
}

function endGame() {
  gameEnded = true;
  isPlaying = false;
  if (sound && sound.isLoaded()) {
    sound.stop();
  }
  if (defaultOscillator) {
    defaultOscillator.stop();
    defaultGain.amp(0);
  }

  if (score > highScore) {
    highScore = score;
    localStorage.setItem("divibeHighScore", highScore);
  }
}

function updateTargetBeatPositions() {
  if (targetBeatsPerCycle === 1) {
    targetBeatPositions = [0]; // Only first beat
  } else {
    targetBeatPositions = [0, 2]; // First and third beats
  }
  console.log("Target beats updated:", targetBeatPositions); // Debug log
}

function updateTargetBeatPositionsFromInput() {
  const input = targetBeatInput.value();
  if (input === lastInputValue) return;

  try {
    // Parse the input string into an array of numbers
    const positions = input.split(",").map((num) => parseInt(num.trim()));

    // Validate the input
    if (
      positions.some(isNaN) ||
      positions.some((pos) => pos < 0 || pos >= letterInterval)
    ) {
      console.error(
        "Invalid input: numbers must be between 0 and",
        letterInterval - 1
      );
      return;
    }

    // Update the target positions
    targetBeatPositions = positions;
    lastInputValue = input;
    console.log("Target beats updated:", targetBeatPositions);
  } catch (error) {
    console.error("Error parsing input:", error);
  }
}
