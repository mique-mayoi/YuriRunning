'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const actionButton = document.getElementById('actionButton');
const soundButton = document.getElementById('soundButton');
const statusLine = document.getElementById('statusLine');
const redUltimateVideo = document.getElementById('redUltimateVideo');
const juliusUltimateVideo = document.getElementById('juliusUltimateVideo');

const BGM_VOLUME = 0.2;
const BGM_DUCK_VOLUME = 0.07;
const BGM_PLAYBACK_RATE = 4;

function makeAudio(src, volume, loop = false) {
  const audio = new Audio(src);
  audio.preload = 'auto';
  audio.volume = volume;
  audio.loop = loop;
  return audio;
}

const audioTracks = {
  bgm: makeAudio('assets/audio/main-bgm.mp4', BGM_VOLUME, true),
  jump: makeAudio('assets/audio/jump.wav', 0.38),
  click: makeAudio('assets/audio/click.wav', 0.46),
  hit: makeAudio('assets/audio/hit.wav', 0.58),
  win: makeAudio('assets/audio/win.wav', 0.62),
  lose: makeAudio('assets/audio/lose.wav', 0.62),
  juliusCall: makeAudio('assets/audio/julius-call.wav', 0.72),
  redCall: makeAudio('assets/audio/red-call.wav', 0.72),
};

audioTracks.bgm.defaultPlaybackRate = BGM_PLAYBACK_RATE;
audioTracks.bgm.playbackRate = BGM_PLAYBACK_RATE;
audioTracks.bgm.preservesPitch = false;
audioTracks.bgm.mozPreservesPitch = false;
audioTracks.bgm.webkitPreservesPitch = false;

const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 540;
const GROUND_Y = 438;
const GOAL_METERS = 2000;
const ULTIMATE_AT_METERS = 600;
const METERS_PER_SECOND = 82;
const GRAVITY = 2150;
const JUMP_FORCE = 790;
const QTE_DURATION = 3.7;
const QTE_REQUIRED_HITS = 15;
const CUTOUT_FPS = 20;
const JULIUS_CUTOUT_COUNT = 87;
const RED_CUTOUT_COUNT = 98;
const QTE_FRAME_COUNT = 37;
const QTE_FRAME_DURATION = 0.1;
const RED_CHASE_FRAME_COUNT = 27;
const RED_CHASE_FRAME_DURATION = 0.1;
const QTE_CENTER = { x: VIEW_WIDTH / 2, y: VIEW_HEIGHT / 2 + 8 };
const QTE_RADIUS = 116;
const TAU = Math.PI * 2;
const SPECIAL_CRY = '\u5965\u55f7\u55f7\u54e6\u554a\u55f7\u55f7\u55f7';
const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

canvas.width = Math.round(VIEW_WIDTH * DPR);
canvas.height = Math.round(VIEW_HEIGHT * DPR);
ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

const PATHS = {
  juliusRun1: '素材/跑得贴图/1.png',
  juliusRun2: '素材/跑得贴图/2.png',
  redChase: '素材/跑得贴图/雷德追击贴图/3dc143c13ddd3868d093ff574c165834.gif',
  qte: '素材/qte快速点击动画/12f1ed6a299dbf0afbe1fd11f79e348d.gif',
  redUltimate: '素材/大招以及音频/雷德/ed633e1f321df40eb319971ac12d2cce.mp4',
  juliusUltimate: '素材/大招以及音频/尤利乌斯/6e230f512912d8a27686f4042fb240ff.mp4',
  ending: '素材/结束/ab8bfb6229deb94fc142cad6b88022dd.jpg',
};

function loadImage(src) {
  const image = new Image();
  image.decoding = 'async';
  image.src = src;
  return image;
}

const assets = {
  juliusFrames: [loadImage(PATHS.juliusRun1), loadImage(PATHS.juliusRun2)],
  juliusCutout: Array.from({ length: JULIUS_CUTOUT_COUNT }, (_, index) =>
    loadImage(`assets/keyed/julius/frame_${String(index).padStart(3, '0')}.png`)),
  redCutout: Array.from({ length: RED_CUTOUT_COUNT }, (_, index) =>
    loadImage(`assets/keyed/red/frame_${String(index).padStart(3, '0')}.png`)),
  redChase: loadImage(PATHS.redChase),
  redChaseFrames: Array.from({ length: RED_CHASE_FRAME_COUNT }, (_, index) =>
    loadImage(`assets/red_chase_frames/frame_${String(index).padStart(3, '0')}.png`)),
  qte: loadImage(PATHS.qte),
  qteFrames: Array.from({ length: QTE_FRAME_COUNT }, (_, index) =>
    loadImage(`assets/qte_frames/frame_${String(index).padStart(3, '0')}.png`)),
  ending: loadImage(PATHS.ending),
  sky: loadImage('images/\u5929\u7a7a.png'),
  mountain: loadImage('images/\u5c71.png'),
  trees: [1, 2, 3].map((index) => loadImage(`images/\u6811${index}.png`)),
  bushes: [1, 2].map((index) => loadImage(`images/\u704c\u6728${index}.png`)),
  shortTrees: [1, 2].map((index) => loadImage(`images/\u77ee\u6811${index}.png`)),
  grass: [1, 2, 3].map((index) => loadImage(`images/\u8349${index}.png`)),
};

redUltimateVideo.src = PATHS.redUltimate;
juliusUltimateVideo.src = PATHS.juliusUltimate;
redUltimateVideo.volume = 0.72;
juliusUltimateVideo.volume = 0.72;

const juliusFrameBounds = [
  { x: 500, y: 0, width: 680, height: 920 },
  { x: 480, y: 0, width: 650, height: 900 },
];

const runner = {
  x: 610,
  y: GROUND_Y - 88,
  width: 48,
  height: 88,
  vy: 0,
  grounded: true,
  frame: 0,
  frameTimer: 0,
  hitCooldown: 0,
};

const game = {
  state: 'ready',
  distance: 0,
  elapsed: 0,
  stateElapsed: 0,
  lastTime: 0,
  worldSpeed: 350,
  backgroundOffset: 0,
  obstacleTimer: 1.25,
  obstacles: [],
  danger: 13,
  attackTriggered: false,
  qteHits: 0,
  qteTimeLeft: QTE_DURATION,
  qtePulse: 0,
  qteMissFlash: 0,
  soundEnabled: true,
  shake: 0,
  callout: '',
  calloutTimer: 0,
  confetti: [],
  particles: [],
};

let audioContext = null;
let masterGain = null;
let musicTimer = null;
let musicStep = 0;
let chaseFrameTimestamp = -Infinity;
let lastCharacterCallAt = -Infinity;

const chaseCanvas = document.createElement('canvas');
const chaseContext = chaseCanvas.getContext('2d', { willReadFrequently: true });
chaseCanvas.width = 240;
chaseCanvas.height = 320;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function loopValue(value, size) {
  return ((value % size) + size) % size;
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function setStatus(text) {
  if (statusLine) {
    statusLine.textContent = text;
  }
}

function setAction(label, hidden = false) {
  actionButton.textContent = label;
  actionButton.hidden = hidden;
  actionButton.setAttribute('aria-label', label);
}

function ensureAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    masterGain.gain.value = game.soundEnabled ? 0.82 : 0;
    masterGain.connect(audioContext.destination);
  }

  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
}

function tone(frequency, duration, type = 'sine', volume = 0.08, delay = 0, detune = 0) {
  if (!game.soundEnabled) {
    return;
  }
  ensureAudio();
  if (!audioContext || !masterGain) {
    return;
  }

  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.detune.setValueAtTime(detune, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(masterGain);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function noiseBurst(duration = 0.08, volume = 0.04) {
  if (!game.soundEnabled) {
    return;
  }
  ensureAudio();
  if (!audioContext || !masterGain) {
    return;
  }

  const sampleCount = Math.max(1, Math.round(audioContext.sampleRate * duration));
  const buffer = audioContext.createBuffer(1, sampleCount, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
  }
  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  gain.gain.value = volume;
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(masterGain);
  source.start();
}

function startMusicClock() {
  if (!game.soundEnabled || !audioTracks.bgm.paused) {
    return;
  }
  audioTracks.bgm.playbackRate = BGM_PLAYBACK_RATE;
  audioTracks.bgm.play().catch(() => {});
}

function setSoundEnabled(enabled) {
  game.soundEnabled = enabled;
  if (masterGain && audioContext) {
    masterGain.gain.setTargetAtTime(enabled ? 0.82 : 0, audioContext.currentTime, 0.02);
  }
  redUltimateVideo.muted = !enabled;
  juliusUltimateVideo.muted = !enabled;
  Object.values(audioTracks).forEach((audio) => {
    audio.muted = !enabled;
  });
  if (enabled && game.state !== 'ready') {
    startMusicClock();
  } else if (!enabled) {
    audioTracks.bgm.pause();
  }
  soundButton.textContent = enabled ? '●' : '○';
  soundButton.setAttribute('aria-label', enabled ? '关闭声音' : '打开声音');
}

function playAudio(audio, restart = true) {
  if (!game.soundEnabled) {
    return;
  }
  if (restart) {
    audio.currentTime = 0;
  }
  audio.play().catch(() => {});
}

function playCharacterCall(track, minGap = 0.65) {
  if (!game.soundEnabled || performance.now() - lastCharacterCallAt < minGap * 1000) {
    return;
  }
  lastCharacterCallAt = performance.now();
  const voice = track.cloneNode();
  voice.volume = track.volume;
  voice.muted = !game.soundEnabled;
  voice.playbackRate = randomBetween(0.96, 1.04);
  voice.play().catch(() => {});
}

function playJumpSound() {
  playAudio(audioTracks.jump);
  playCharacterCall(audioTracks.juliusCall, 0.72);
}

function playCollisionSound() {
  playAudio(audioTracks.hit);
  playCharacterCall(audioTracks.redCall, 0.62);
}

function playQteHitSound(hit) {
  if (!game.soundEnabled) {
    return;
  }
  const click = audioTracks.click.cloneNode();
  click.volume = Math.min(0.6, 0.34 + hit * 0.012);
  click.play().catch(() => {});
}

function playSuccessSound() {
  playAudio(audioTracks.win);
}

function playFailureSound() {
  playAudio(audioTracks.lose);
}

function resetRunner() {
  Object.assign(runner, {
    x: 610,
    y: GROUND_Y - 88,
    vy: 0,
    grounded: true,
    frame: 0,
    frameTimer: 0,
    hitCooldown: 0,
  });
}

function resetGame() {
  pauseSpecialVideos();
  resetRunner();
  Object.assign(game, {
    state: 'running',
    distance: 0,
    elapsed: 0,
    stateElapsed: 0,
    lastTime: performance.now(),
    worldSpeed: 350,
    backgroundOffset: 0,
    obstacleTimer: 1.15,
    obstacles: [],
    danger: 13,
    attackTriggered: false,
    qteHits: 0,
    qteTimeLeft: QTE_DURATION,
    qtePulse: 0,
    qteMissFlash: 0,
    shake: 0,
    callout: '',
    calloutTimer: 0,
    confetti: [],
    particles: [],
  });
  setAction('跳');
  setStatus('');
}

function startGame() {
  ensureAudio();
  primeSpecialVideos();
  audioTracks.bgm.currentTime = 0;
  audioTracks.bgm.playbackRate = BGM_PLAYBACK_RATE;
  startMusicClock();
  resetGame();
  playAudio(audioTracks.click);
}

function jumpRunner() {
  if (game.state !== 'running' || !runner.grounded) {
    return;
  }
  runner.grounded = false;
  runner.vy = -JUMP_FORCE;
  playJumpSound();
}

function pauseSpecialVideos() {
  for (const video of [redUltimateVideo, juliusUltimateVideo]) {
    video.pause();
    try {
      video.currentTime = 0;
    } catch (_error) {
      // Metadata may not be available yet.
    }
  }
}

function primeSpecialVideos() {
  for (const video of [redUltimateVideo, juliusUltimateVideo]) {
    video.muted = true;
    const playResult = video.play();
    if (playResult && typeof playResult.then === 'function') {
      playResult.then(() => {
        if (game.state === 'running' || game.state === 'ready') {
          video.pause();
          video.currentTime = 0;
          video.muted = !game.soundEnabled;
        }
      }).catch(() => {});
    }
  }
}

function playSpecialVideo(video) {
  video.muted = !game.soundEnabled;
  video.volume = 0.72;
  try {
    video.currentTime = 0;
  } catch (_error) {
    // The fallback timer still advances the sequence.
  }
  const playResult = video.play();
  if (playResult && typeof playResult.catch === 'function') {
    playResult.catch(() => {
      tone(92, 0.35, 'sawtooth', 0.075);
    });
  }
}

function beginUltimate() {
  if (game.attackTriggered || game.state !== 'running') {
    return;
  }
  game.attackTriggered = true;
  game.state = 'ultimate';
  game.stateElapsed = 0;
  game.obstacles = [];
  game.shake = 10;
  audioTracks.bgm.volume = BGM_DUCK_VOLUME;
  setAction('', true);
  setStatus('');
  playSpecialVideo(redUltimateVideo);
}

function restartQteAnimation() {
  assets.qte.src = '';
  assets.qte.src = `${PATHS.qte}?round=${Date.now()}`;
}

function beginQte() {
  if (game.state !== 'ultimate') {
    return;
  }
  redUltimateVideo.pause();
  game.state = 'qte';
  game.stateElapsed = 0;
  game.qteHits = 0;
  game.qteTimeLeft = QTE_DURATION;
  game.qtePulse = 1;
  game.qteMissFlash = 0;
  game.particles = [];
  restartQteAnimation();
  setAction('', true);
  setStatus('');
}

function beginCounter() {
  if (game.state !== 'qte') {
    return;
  }
  game.state = 'counter';
  game.stateElapsed = 0;
  game.distance = Math.min(GOAL_METERS - 1, game.distance + 80);
  game.danger = Math.max(5, game.danger - 18);
  setAction('', true);
  setStatus('');
  playSuccessSound();
  playSpecialVideo(juliusUltimateVideo);
}

function resumeAfterCounter() {
  if (game.state !== 'counter') {
    return;
  }
  juliusUltimateVideo.pause();
  game.state = 'running';
  game.stateElapsed = 0;
  game.obstacleTimer = 1.4;
  game.callout = '+80 m';
  game.calloutTimer = 1.2;
  audioTracks.bgm.volume = BGM_VOLUME;
  setAction('跳');
  setStatus('');
}

function beginCaught() {
  if (game.state === 'caught' || game.state === 'victory') {
    return;
  }
  pauseSpecialVideos();
  game.state = 'caught';
  game.stateElapsed = 0;
  game.shake = 16;
  game.callout = '';
  game.calloutTimer = 0;
  audioTracks.bgm.pause();
  setAction('\u518d\u8dd1');
  setStatus('');
  playFailureSound();
}

function beginVictory() {
  if (game.state === 'victory') {
    return;
  }
  pauseSpecialVideos();
  game.state = 'victory';
  game.distance = GOAL_METERS;
  game.stateElapsed = 0;
  game.obstacles = [];
  game.confetti = Array.from({ length: 92 }, (_, index) => ({
    x: randomBetween(80, VIEW_WIDTH - 80),
    y: randomBetween(-240, -12),
    vx: randomBetween(-38, 38),
    vy: randomBetween(80, 210),
    size: randomBetween(5, 12),
    rotation: randomBetween(0, TAU),
    spin: randomBetween(-5, 5),
    color: ['#d9ff53', '#f04f44', '#67d9e8', '#ffc84a', '#f7f4e8'][index % 5],
  }));
  audioTracks.bgm.pause();
  setAction('\u518d\u8dd1');
  setStatus('');
  playSuccessSound();
  tone(988, 0.42, 'sine', 0.055, 0.34);
}

redUltimateVideo.addEventListener('ended', () => {
  if (game.state === 'ultimate') {
    beginQte();
  }
});

juliusUltimateVideo.addEventListener('ended', () => {
  if (game.state === 'counter') {
    resumeAfterCounter();
  }
});

function spawnObstacle() {
  const kinds = ['cone', 'banana', 'stool'];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const sizes = {
    cone: { width: 42, height: 54 },
    banana: { width: 52, height: 24 },
    stool: { width: 56, height: 48 },
  };
  const size = sizes[kind];
  game.obstacles.push({
    kind,
    x: VIEW_WIDTH + 40,
    width: size.width,
    height: size.height,
    wobble: randomBetween(0, TAU),
    hit: false,
  });
}

function runnerHitbox() {
  return {
    x: runner.x + 8,
    y: runner.y + 18,
    width: runner.width - 15,
    height: runner.height - 19,
  };
}

function overlaps(a, b) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

function handleObstacleHit(obstacle) {
  obstacle.hit = true;
  runner.hitCooldown = 0.85;
  runner.vy = -320;
  runner.grounded = false;
  game.danger = Math.min(100, game.danger + 29);
  game.shake = 10;
  game.callout = obstacle.kind === 'banana' ? '滑！' : obstacle.kind === 'stool' ? '绊！' : '撞！';
  game.calloutTimer = 0.72;
  playCollisionSound();
  if (game.danger >= 96) {
    beginCaught();
  }
}

function updateRunner(dt) {
  runner.frameTimer += dt;
  if (runner.frameTimer >= 0.12) {
    runner.frameTimer -= 0.12;
    runner.frame = (runner.frame + 1) % assets.juliusFrames.length;
  }

  runner.hitCooldown = Math.max(0, runner.hitCooldown - dt);
  if (!runner.grounded) {
    runner.vy += GRAVITY * dt;
    runner.y += runner.vy * dt;
    if (runner.y >= GROUND_Y - runner.height) {
      runner.y = GROUND_Y - runner.height;
      runner.vy = 0;
      runner.grounded = true;
    }
  }
}

function updateRunning(dt) {
  game.elapsed += dt;
  game.distance += METERS_PER_SECOND * dt;
  game.worldSpeed = 350 + Math.min(95, game.distance * 0.035);
  game.backgroundOffset += game.worldSpeed * dt;
  game.danger = Math.max(7, game.danger - dt * 0.7);

  updateRunner(dt);

  game.obstacleTimer -= dt;
  const isNearAttack = !game.attackTriggered && game.distance > ULTIMATE_AT_METERS - 100;
  if (game.obstacleTimer <= 0 && !isNearAttack) {
    spawnObstacle();
    game.obstacleTimer = randomBetween(1.25, 2.05);
  }

  const hitbox = runnerHitbox();
  for (const obstacle of game.obstacles) {
    obstacle.x -= game.worldSpeed * dt;
    obstacle.wobble += dt * 5;
    const obstacleBox = {
      x: obstacle.x + 5,
      y: GROUND_Y - obstacle.height + 5,
      width: obstacle.width - 10,
      height: obstacle.height - 5,
    };
    if (!obstacle.hit && runner.hitCooldown <= 0 && overlaps(hitbox, obstacleBox)) {
      handleObstacleHit(obstacle);
    }
  }
  game.obstacles = game.obstacles.filter((obstacle) => obstacle.x + obstacle.width > -30 && !obstacle.hit);

  if (!game.attackTriggered && game.distance >= ULTIMATE_AT_METERS) {
    beginUltimate();
    return;
  }

  if (game.distance >= GOAL_METERS) {
    beginVictory();
  }
}

function updateParticles(dt) {
  for (const particle of game.particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 180 * dt;
    particle.rotation += particle.spin * dt;
  }
  game.particles = game.particles.filter((particle) => particle.life > 0);
}

function updateConfetti(dt) {
  for (const piece of game.confetti) {
    piece.x += piece.vx * dt;
    piece.y += piece.vy * dt;
    piece.rotation += piece.spin * dt;
    if (piece.y > VIEW_HEIGHT + 24) {
      piece.y = randomBetween(-160, -20);
      piece.x = randomBetween(30, VIEW_WIDTH - 30);
    }
  }
}

function update(dt) {
  game.stateElapsed += dt;
  game.qtePulse = Math.max(0, game.qtePulse - dt * 4.6);
  game.qteMissFlash = Math.max(0, game.qteMissFlash - dt * 3.8);
  game.shake = Math.max(0, game.shake - dt * 24);
  game.calloutTimer = Math.max(0, game.calloutTimer - dt);
  updateParticles(dt);

  if (game.state === 'running') {
    updateRunning(dt);
  } else if (game.state === 'ultimate') {
    game.backgroundOffset += 90 * dt;
    if (game.stateElapsed >= 5.15) {
      beginQte();
    }
  } else if (game.state === 'qte') {
    game.qteTimeLeft = Math.max(0, game.qteTimeLeft - dt);
    if (game.qteTimeLeft <= 0) {
      beginCaught();
    }
  } else if (game.state === 'counter') {
    game.backgroundOffset += 120 * dt;
    if (game.stateElapsed >= 4.65) {
      resumeAfterCounter();
    }
  } else if (game.state === 'victory') {
    updateConfetti(dt);
  }
}

function drawSky() {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, '#91d9f5');
  sky.addColorStop(0.68, '#bfeaf2');
  sky.addColorStop(1, '#e8f3d1');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_WIDTH, GROUND_Y);

  if (assets.sky.complete && assets.sky.naturalWidth) {
    ctx.save();
    ctx.globalAlpha = 0.96;
    ctx.drawImage(assets.sky, 0, 0, VIEW_WIDTH, GROUND_Y + 8);
    const light = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    light.addColorStop(0, 'rgba(88,231,255,0.08)');
    light.addColorStop(0.72, 'rgba(217,255,69,0.035)');
    light.addColorStop(1, 'rgba(255,201,74,0.12)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, VIEW_WIDTH, GROUND_Y);
    ctx.restore();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  for (let index = 0; index < 6; index += 1) {
    const x = loopValue(index * 202 - game.backgroundOffset * 0.055, VIEW_WIDTH + 260) - 130;
    const y = 72 + (index % 3) * 46;
    ctx.fillRect(x, y, 58, 13);
    ctx.fillRect(x + 13, y - 10, 32, 10);
  }
}

function drawLoopedSceneSprites(frames, items, speed, frameRate = 7) {
  if (!frames.length) return;
  const frame = frames[Math.floor(game.elapsed * frameRate) % frames.length];
  if (!frame.complete || !frame.naturalWidth) return;
  const wrap = VIEW_WIDTH + 280;
  for (const item of items) {
    const x = loopValue(item.x - game.backgroundOffset * speed * item.depth, wrap) - 140;
    const height = item.height;
    const width = height * (frame.naturalWidth / Math.max(1, frame.naturalHeight));
    ctx.save();
    ctx.globalAlpha = item.alpha;
    ctx.translate(Math.round(x), GROUND_Y + item.y);
    if (item.flip) ctx.scale(-1, 1);
    ctx.drawImage(frame, -width / 2, -height, width, height);
    ctx.restore();
  }
}

function drawFarScenery() {
  if (assets.mountain.complete && assets.mountain.naturalWidth) {
    const tileWidth = 610;
    const tileHeight = 202;
    const shift = loopValue(game.backgroundOffset * 0.085, tileWidth);
    ctx.save();
    ctx.globalAlpha = 0.78;
    ctx.filter = 'saturate(82%) brightness(1.05)';
    for (let index = -1; index <= 2; index += 1) {
      ctx.drawImage(assets.mountain, index * tileWidth - shift, GROUND_Y - tileHeight + 22, tileWidth, tileHeight);
    }
    ctx.restore();
  }

  drawLoopedSceneSprites(assets.trees, [
    { x: 70, height: 168, y: 0, depth: 0.72, alpha: 0.82 },
    { x: 255, height: 126, y: 2, depth: 0.84, alpha: 0.76, flip: true },
    { x: 440, height: 182, y: 0, depth: 0.78, alpha: 0.84 },
    { x: 660, height: 142, y: 2, depth: 0.9, alpha: 0.78, flip: true },
    { x: 850, height: 174, y: 0, depth: 0.8, alpha: 0.84 },
    { x: 1050, height: 132, y: 2, depth: 0.88, alpha: 0.78 },
  ], 0.31, 6.5);

  drawLoopedSceneSprites(assets.shortTrees, [
    { x: 150, height: 92, y: 2, depth: 0.94, alpha: 0.92 },
    { x: 355, height: 78, y: 2, depth: 1.04, alpha: 0.88, flip: true },
    { x: 565, height: 102, y: 2, depth: 0.98, alpha: 0.93 },
    { x: 770, height: 82, y: 2, depth: 1.08, alpha: 0.88 },
    { x: 980, height: 96, y: 2, depth: 1.0, alpha: 0.92, flip: true },
  ], 0.39, 7);

  const signs = [
    { x: 110, text: '\u5feb', color: '#ff4862' },
    { x: 510, text: '\u522b\u56de\u5934', color: '#ffc94a' },
    { x: 855, text: '2000m', color: '#58e7ff' },
  ];
  for (const sign of signs) {
    const x = loopValue(sign.x - game.backgroundOffset * 0.42, VIEW_WIDTH + 360) - 180;
    ctx.fillStyle = '#3b332d'; ctx.fillRect(x + 35, GROUND_Y - 84, 7, 84);
    ctx.fillStyle = sign.color; ctx.fillRect(x, GROUND_Y - 123, 78, 48);
    ctx.strokeStyle = '#171a18'; ctx.lineWidth = 4; ctx.strokeRect(x, GROUND_Y - 123, 78, 48);
    ctx.fillStyle = '#171a18'; ctx.font = '900 17px Microsoft YaHei'; ctx.textAlign = 'center';
    ctx.fillText(sign.text, x + 39, GROUND_Y - 92);
  }
}

function drawGround() {
  const soil = ctx.createLinearGradient(0, GROUND_Y, 0, VIEW_HEIGHT);
  soil.addColorStop(0, '#6d4b2b');
  soil.addColorStop(0.44, '#51351f');
  soil.addColorStop(1, '#2d211a');
  ctx.fillStyle = soil;
  ctx.fillRect(0, GROUND_Y, VIEW_WIDTH, VIEW_HEIGHT - GROUND_Y);

  ctx.fillStyle = '#254d29';
  ctx.fillRect(0, GROUND_Y - 10, VIEW_WIDTH, 14);
  ctx.fillStyle = '#79b84b';
  ctx.fillRect(0, GROUND_Y - 10, VIEW_WIDTH, 5);
  ctx.fillStyle = '#c8ed67';
  ctx.fillRect(0, GROUND_Y - 10, VIEW_WIDTH, 2);

  drawLoopedSceneSprites(assets.bushes, [
    { x: 80, height: 57, y: 1, depth: 1.06, alpha: 0.98 },
    { x: 245, height: 49, y: 1, depth: 1.16, alpha: 0.96, flip: true },
    { x: 425, height: 63, y: 1, depth: 1.08, alpha: 0.98 },
    { x: 610, height: 52, y: 1, depth: 1.18, alpha: 0.96 },
    { x: 790, height: 60, y: 1, depth: 1.1, alpha: 0.98, flip: true },
    { x: 980, height: 50, y: 1, depth: 1.2, alpha: 0.96 },
  ], 0.46, 7.5);

  drawLoopedSceneSprites(assets.grass, [
    { x: 20, height: 27, y: 0, depth: 1.0, alpha: 1 },
    { x: 150, height: 22, y: 0, depth: 1.12, alpha: 0.96, flip: true },
    { x: 285, height: 30, y: 0, depth: 1.06, alpha: 1 },
    { x: 430, height: 23, y: 0, depth: 1.18, alpha: 0.96 },
    { x: 575, height: 29, y: 0, depth: 1.08, alpha: 1, flip: true },
    { x: 720, height: 21, y: 0, depth: 1.2, alpha: 0.96 },
    { x: 865, height: 28, y: 0, depth: 1.1, alpha: 1 },
    { x: 1010, height: 24, y: 0, depth: 1.16, alpha: 0.96, flip: true },
  ], 0.55, 8);

  ctx.fillStyle = 'rgba(191,135,82,0.6)';
  for (let index = 0; index < 22; index += 1) {
    const x = loopValue(index * 53 - game.backgroundOffset * 0.58, VIEW_WIDTH + 60) - 30;
    const y = GROUND_Y + 25 + (index % 3) * 22;
    ctx.fillRect(x, y, 7 + (index % 4) * 3, 3);
  }
  ctx.strokeStyle = 'rgba(31,22,17,0.38)';
  ctx.lineWidth = 2;
  for (let index = 0; index < 9; index += 1) {
    const x = loopValue(index * 127 - game.backgroundOffset * 0.34, VIEW_WIDTH + 140) - 70;
    const y = GROUND_Y + 42 + (index % 2) * 25;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 30, y + 2); ctx.stroke();
  }
}

function drawBackground() {
  drawSky();
  drawFarScenery();
  drawGround();
}

function updateChaseCutout(timestamp) {
  if (!assets.redChase.complete || !assets.redChase.naturalWidth || timestamp - chaseFrameTimestamp < 66) {
    return;
  }
  chaseFrameTimestamp = timestamp;
  chaseContext.clearRect(0, 0, chaseCanvas.width, chaseCanvas.height);
  chaseContext.drawImage(assets.redChase, 0, 0, chaseCanvas.width, chaseCanvas.height);

  try {
    const frame = chaseContext.getImageData(0, 0, chaseCanvas.width, chaseCanvas.height);
    const pixels = frame.data;
    const seeds = new Uint8Array(chaseCanvas.width * chaseCanvas.height);
    for (let pixel = 0; pixel < seeds.length; pixel += 1) {
      const index = pixel * 4;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const redCloth = r > 70 && r > g * 1.22 && r > b * 1.12;
      const skin = r > 115 && g > 65 && r > g * 1.09 && g > b * 1.09;
      seeds[pixel] = redCloth || skin ? 1 : 0;
    }
    for (let index = 0; index < pixels.length; index += 4) {
      const pixel = index / 4;
      const x = pixel % chaseCanvas.width;
      const y = Math.floor(pixel / chaseCanvas.width);
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      if (seeds[pixel]) {
        continue;
      }
      const mayBeOutline = Math.max(r, g, b) < 125 || (r > g * 1.06 && r > b * 1.04);
      if (!mayBeOutline) {
        pixels[index + 3] = 0;
        continue;
      }
      let nearby = false;
      for (let dy = -4; dy <= 4 && !nearby; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= chaseCanvas.height) {
          continue;
        }
        for (let dx = -4; dx <= 4; dx += 1) {
          const nx = x + dx;
          if (nx >= 0 && nx < chaseCanvas.width && seeds[ny * chaseCanvas.width + nx]) {
            nearby = true;
            break;
          }
        }
      }
      pixels[index + 3] = nearby ? 255 : 0;
    }
    chaseContext.putImageData(frame, 0, 0);
  } catch (_error) {
    // The unprocessed GIF remains visible when local-file canvas access is restricted.
  }
}

function drawPursuer(timestamp) {
  const frameIndex = Math.floor((timestamp / 1000) / RED_CHASE_FRAME_DURATION) % RED_CHASE_FRAME_COUNT;
  const chaseFrame = assets.redChaseFrames[frameIndex];
  const pursuitX = 132 + game.danger * 2.55;
  const bob = Math.sin(game.elapsed * 12) * 4;
  const drawHeight = 176;
  const sourceWidth = chaseFrame && chaseFrame.naturalWidth ? chaseFrame.naturalWidth : chaseCanvas.width;
  const sourceHeight = chaseFrame && chaseFrame.naturalHeight ? chaseFrame.naturalHeight : chaseCanvas.height;
  const drawWidth = drawHeight * (sourceWidth / sourceHeight);

  ctx.save();
  ctx.translate(pursuitX, GROUND_Y + bob);
  ctx.fillStyle = 'rgba(20,22,20,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 54, 10, 0, 0, TAU);
  ctx.fill();
  ctx.shadowColor = '#f04f44';
  ctx.shadowBlur = 12 + game.danger * 0.08;
  if (chaseFrame && chaseFrame.complete && chaseFrame.naturalWidth) {
    ctx.drawImage(chaseFrame, -drawWidth / 2, -drawHeight, drawWidth, drawHeight);
  } else {
    updateChaseCutout(timestamp);
    ctx.drawImage(chaseCanvas, -drawWidth / 2, -drawHeight, drawWidth, drawHeight);
  }
  ctx.restore();
}

function drawRunner() {
  const image = assets.juliusFrames[runner.frame];
  const bounds = juliusFrameBounds[runner.frame];
  const drawHeight = 174;
  const drawWidth = drawHeight * (bounds.width / bounds.height);
  const centerX = runner.x + runner.width / 2;
  const footY = runner.y + runner.height;

  ctx.save();
  ctx.fillStyle = 'rgba(20,22,20,0.25)';
  ctx.beginPath();
  ctx.ellipse(centerX, GROUND_Y + 4, runner.grounded ? 48 : 32, 9, 0, 0, TAU);
  ctx.fill();
  ctx.translate(centerX, footY);
  if (!runner.grounded) {
    ctx.rotate(clamp(runner.vy / 4200, -0.15, 0.12));
  }
  if (runner.hitCooldown > 0 && Math.floor(runner.hitCooldown * 14) % 2 === 0) {
    ctx.globalAlpha = 0.48;
  }
  if (image.complete && image.naturalWidth) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      image,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      -drawWidth / 2,
      -drawHeight,
      drawWidth,
      drawHeight
    );
  } else {
    ctx.fillStyle = '#f7f4e8';
    ctx.fillRect(-24, -92, 48, 92);
  }
  ctx.restore();
}

function drawCone(obstacle) {
  const x = obstacle.x;
  const y = GROUND_Y - obstacle.height;
  ctx.fillStyle = '#f04f44';
  ctx.beginPath();
  ctx.moveTo(x + obstacle.width / 2, y);
  ctx.lineTo(x + obstacle.width - 8, y + obstacle.height - 9);
  ctx.lineTo(x + 8, y + obstacle.height - 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f7f4e8';
  ctx.fillRect(x + 12, y + 27, obstacle.width - 24, 8);
  ctx.fillStyle = '#171a18';
  ctx.fillRect(x, y + obstacle.height - 9, obstacle.width, 9);
}

function drawBanana(obstacle) {
  const x = obstacle.x + obstacle.width / 2;
  const y = GROUND_Y - 7;
  ctx.strokeStyle = '#ffc84a';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x - 12, y - 7, 22, 0.08, 1.75);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + 12, y - 7, 22, 1.38, 3.02);
  ctx.stroke();
  ctx.strokeStyle = '#5a4330';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawStool(obstacle) {
  const x = obstacle.x;
  const y = GROUND_Y - obstacle.height;
  ctx.save();
  ctx.translate(x + obstacle.width / 2, y + obstacle.height / 2);
  ctx.rotate(Math.sin(obstacle.wobble) * 0.045);
  ctx.fillStyle = '#67d9e8';
  ctx.fillRect(-25, -22, 50, 14);
  ctx.strokeStyle = '#171a18';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-17, -8);
  ctx.lineTo(-22, 23);
  ctx.moveTo(17, -8);
  ctx.lineTo(22, 23);
  ctx.stroke();
  ctx.restore();
}

function drawObstacle(obstacle) {
  if (obstacle.kind === 'cone') {
    drawCone(obstacle);
  } else if (obstacle.kind === 'banana') {
    drawBanana(obstacle);
  } else {
    drawStool(obstacle);
  }
}

function drawHud() {
  const progress = clamp(game.distance / GOAL_METERS, 0, 1);
  const danger = clamp(game.danger / 100, 0, 1);
  const pulse = game.danger > 75 ? 0.88 + Math.sin(game.elapsed * 8) * 0.12 : 1;
  ctx.save();
  const cardGradient = ctx.createLinearGradient(22, 18, 342, 92);
  cardGradient.addColorStop(0, 'rgba(10,14,23,0.94)');
  cardGradient.addColorStop(1, 'rgba(19,28,38,0.82)');
  ctx.fillStyle = cardGradient;
  roundedRect(ctx, 22, 18, 300, 72, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#fffbea';
  ctx.font = '1000 30px Microsoft YaHei';
  ctx.textAlign = 'left';
  ctx.fillText(String(Math.min(GOAL_METERS, Math.floor(game.distance))).padStart(4, '0'), 43, 54);
  ctx.fillStyle = '#8f98ab';
  ctx.font = '900 12px Microsoft YaHei';
  ctx.fillText('m', 122, 54);
  ctx.textAlign = 'right';
  ctx.fillText('/ 2000', 300, 52);
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  roundedRect(ctx, 43, 69, 257, 8, 4);
  ctx.fill();
  const meterGradient = ctx.createLinearGradient(43, 0, 300, 0);
  meterGradient.addColorStop(0, '#d9ff45');
  meterGradient.addColorStop(0.55, '#8cf78c');
  meterGradient.addColorStop(1, '#58e7ff');
  ctx.fillStyle = meterGradient;
  roundedRect(ctx, 43, 69, Math.max(7, 257 * progress), 8, 4);
  ctx.fill();
  ctx.globalAlpha = pulse;
  const dangerX = 852;
  ctx.fillStyle = 'rgba(10,14,23,0.9)';
  ctx.beginPath();
  ctx.arc(dangerX, 54, 36, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = game.danger > 75 ? '#ff4862' : 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(dangerX, 54, 25, -Math.PI / 2, Math.PI * 1.5);
  ctx.stroke();
  ctx.strokeStyle = game.danger > 75 ? '#ff4862' : game.danger > 50 ? '#ff8a4d' : '#ffc94a';
  ctx.beginPath();
  ctx.arc(dangerX, 54, 25, -Math.PI / 2, -Math.PI / 2 + TAU * danger);
  ctx.stroke();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.moveTo(dangerX, 39);
  ctx.lineTo(dangerX + 8, 58);
  ctx.lineTo(dangerX - 8, 58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#090b13';
  ctx.fillRect(dangerX - 1.5, 46, 3, 7);
  ctx.fillRect(dangerX - 1.5, 55, 3, 3);
  ctx.restore();
}

function drawCallout() {
  if (!game.callout || game.calloutTimer <= 0) {
    return;
  }
  const alpha = Math.min(1, game.calloutTimer * 2.4);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '950 20px Microsoft YaHei';
  const width = Math.min(620, ctx.measureText(game.callout).width + 42);
  const x = (VIEW_WIDTH - width) / 2;
  ctx.fillStyle = '#171a18';
  roundedRect(ctx, x, 101, width, 44, 5);
  ctx.fill();
  ctx.fillStyle = '#ffc84a';
  ctx.textAlign = 'center';
  ctx.fillText(game.callout, VIEW_WIDTH / 2, 131);
  ctx.restore();
}

function drawCutoutFrames(frames, video) {
  const videoTime = video.readyState >= 2 ? video.currentTime : game.stateElapsed;
  const index = clamp(Math.floor(videoTime * CUTOUT_FPS), 0, frames.length - 1);
  const frame = frames[index];
  if (!frame.complete || !frame.naturalWidth) {
    return false;
  }
  ctx.drawImage(frame, 75, 92, 810, 456);
  return true;
}

function drawSpeedLines(color, amount, phase) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.6;
  for (let index = 0; index < amount; index += 1) {
    const y = 58 + ((index * 47 + phase * (35 + index % 4)) % (VIEW_HEIGHT - 96));
    const length = 55 + (index % 5) * 22;
    const x = loopValue(index * 129 - phase * 210, VIEW_WIDTH + 180) - 90;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + length, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawUltimate(timestamp) {
  ctx.save();
  const glow = ctx.createRadialGradient(VIEW_WIDTH / 2, 290, 28, VIEW_WIDTH / 2, 290, 430);
  glow.addColorStop(0, 'rgba(255,72,98,0.5)');
  glow.addColorStop(0.55, 'rgba(103,13,38,0.86)');
  glow.addColorStop(1, 'rgba(20,3,12,0.98)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  drawSpeedLines('#ffc94a', 24, game.stateElapsed);
  ctx.fillStyle = '#080a12';
  ctx.fillRect(0, 0, VIEW_WIDTH, 12);
  ctx.fillRect(0, VIEW_HEIGHT - 12, VIEW_WIDTH, 12);
  if (game.stateElapsed < 1.08) {
    const alpha = clamp(1 - Math.max(0, game.stateElapsed - 0.72) / 0.36, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.translate(VIEW_WIDTH / 2, 66);
    ctx.rotate(-0.025);
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff4862';
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#fffbea';
    ctx.font = '1000 42px Microsoft YaHei';
    ctx.fillText(SPECIAL_CRY, 0, 0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffc94a';
    ctx.fillRect(-178, 13, 356, 5);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  const drawn = drawCutoutFrames(assets.redCutout, redUltimateVideo);
  if (!drawn) {
    ctx.strokeStyle = '#ff4862'; ctx.lineWidth = 12; ctx.beginPath();
    ctx.arc(VIEW_WIDTH / 2, 292, 92, game.stateElapsed * 3, game.stateElapsed * 3 + Math.PI * 1.35); ctx.stroke();
  }
  ctx.restore();
}

function drawQteParticles() {
  for (const particle of game.particles) {
    ctx.save();
    ctx.globalAlpha = clamp(particle.life / 0.7, 0, 1);
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.rotation);
    ctx.fillStyle = particle.color;
    ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
    ctx.restore();
  }
}

function drawImageCover(image, x, y, width, height) {
  if (!image || !image.complete || !image.naturalWidth) return false;
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sx = 0; let sy = 0; let sw = image.naturalWidth; let sh = image.naturalHeight;
  if (sourceRatio > targetRatio) {
    sw = image.naturalHeight * targetRatio;
    sx = (image.naturalWidth - sw) / 2;
  } else {
    sh = image.naturalWidth / targetRatio;
    sy = (image.naturalHeight - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
  return true;
}

function drawQteAnimation(x, y, width, height, alpha = 1) {
  const frameIndex = Math.floor(game.stateElapsed / QTE_FRAME_DURATION) % QTE_FRAME_COUNT;
  const frame = assets.qteFrames[frameIndex];
  ctx.save();
  ctx.globalAlpha = alpha;
  const drawn = drawImageCover(frame, x, y, width, height);
  if (!drawn) drawImageCover(assets.qte, x, y, width, height);
  ctx.restore();
  return frameIndex;
}

function drawQte() {
  ctx.save();
  const shade = ctx.createRadialGradient(QTE_CENTER.x, QTE_CENTER.y, 70, QTE_CENTER.x, QTE_CENTER.y, 500);
  shade.addColorStop(0, 'rgba(9,13,14,0.3)');
  shade.addColorStop(1, 'rgba(5,7,12,0.92)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.save();
  roundedRect(ctx, 148, 24, 664, 492, 25);
  ctx.clip();
  drawQteAnimation(148, 24, 664, 492, 0.82);
  ctx.restore();
  ctx.restore();
  ctx.save();
  const pulse = 1 + game.qtePulse * 0.12 + Math.sin(game.stateElapsed * 11) * 0.025;
  ctx.translate(QTE_CENTER.x, QTE_CENTER.y);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = game.qteMissFlash > 0 ? '#ff4862' : '#d9ff45';
  ctx.shadowBlur = 28;
  ctx.fillStyle = game.qteMissFlash > 0 ? '#ff4862' : 'rgba(10,14,18,0.9)';
  ctx.beginPath(); ctx.arc(0, 0, QTE_RADIUS, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 11;
  ctx.beginPath(); ctx.arc(0, 0, QTE_RADIUS - 8, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#d9ff45'; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, QTE_RADIUS - 8, -Math.PI / 2, -Math.PI / 2 + TAU * (game.qteHits / QTE_REQUIRED_HITS)); ctx.stroke();
  ctx.fillStyle = '#fffbea'; ctx.font = '1000 50px Microsoft YaHei'; ctx.textAlign = 'center';
  ctx.fillText(String(game.qteHits), 0, 15);
  ctx.fillStyle = '#8f98ab'; ctx.font = '900 15px Microsoft YaHei'; ctx.fillText('/ 15', 0, 43);
  ctx.restore();
  ctx.fillStyle = 'rgba(9,11,19,0.82)'; roundedRect(ctx, 380, 25, 200, 46, 14); ctx.fill();
  ctx.fillStyle = '#fffbea'; ctx.font = '1000 20px Microsoft YaHei'; ctx.textAlign = 'center';
  ctx.fillText(game.qteTimeLeft.toFixed(1), VIEW_WIDTH / 2, 55);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; roundedRect(ctx, 302, 82, 356, 8, 4); ctx.fill();
  ctx.fillStyle = game.qteTimeLeft < 1.2 ? '#ff4862' : '#58e7ff'; roundedRect(ctx, 302, 82, 356 * (game.qteTimeLeft / QTE_DURATION), 8, 4); ctx.fill();
  drawQteParticles();
  ctx.restore();
}

function drawCounter(timestamp) {
  ctx.save();
  const glow = ctx.createRadialGradient(VIEW_WIDTH / 2, 290, 28, VIEW_WIDTH / 2, 290, 440);
  glow.addColorStop(0, 'rgba(88,231,255,0.42)');
  glow.addColorStop(0.5, 'rgba(18,83,101,0.78)');
  glow.addColorStop(1, 'rgba(4,20,31,0.98)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  drawSpeedLines('#d9ff45', 21, -game.stateElapsed);
  ctx.fillStyle = '#080a12'; ctx.fillRect(0, 0, VIEW_WIDTH, 12); ctx.fillRect(0, VIEW_HEIGHT - 12, VIEW_WIDTH, 12);
  if (game.stateElapsed < 1.05) {
    const alpha = clamp(1 - Math.max(0, game.stateElapsed - 0.7) / 0.35, 0, 1);
    ctx.globalAlpha = alpha; ctx.save(); ctx.translate(VIEW_WIDTH / 2, 67); ctx.rotate(0.02); ctx.textAlign = 'center';
    ctx.shadowColor = '#58e7ff'; ctx.shadowBlur = 24; ctx.fillStyle = '#d9ff45'; ctx.font = '1000 42px Microsoft YaHei';
    ctx.fillText(SPECIAL_CRY, 0, 0); ctx.shadowBlur = 0; ctx.fillStyle = '#58e7ff'; ctx.fillRect(-178, 13, 356, 5); ctx.restore(); ctx.globalAlpha = 1;
  }
  const drawn = drawCutoutFrames(assets.juliusCutout, juliusUltimateVideo);
  if (!drawn) { ctx.strokeStyle = '#58e7ff'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(VIEW_WIDTH / 2, 292, 92, -game.stateElapsed * 3, -game.stateElapsed * 3 + Math.PI * 1.35); ctx.stroke(); }
  ctx.restore();
}

function drawReady() {
  ctx.save();
  const veil = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
  veil.addColorStop(0, 'rgba(6,8,14,0.78)'); veil.addColorStop(0.55, 'rgba(6,8,14,0.54)'); veil.addColorStop(1, 'rgba(6,8,14,0.72)');
  ctx.fillStyle = veil; ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.translate(VIEW_WIDTH / 2, 0); ctx.rotate(-0.025); ctx.textAlign = 'center';
  ctx.shadowColor = '#955cff'; ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 8; ctx.fillStyle = '#fffbea'; ctx.font = '1000 76px Microsoft YaHei';
  ctx.fillText('\u5c24\u5229\u5feb\u8dd1', 0, 252); ctx.shadowColor = 'transparent';
  const streak = ctx.createLinearGradient(-158, 0, 158, 0); streak.addColorStop(0, '#d9ff45'); streak.addColorStop(1, '#58e7ff');
  ctx.fillStyle = streak; ctx.fillRect(-156, 272, 312, 7); ctx.fillRect(-96, 292, 192, 4); ctx.fillRect(-44, 308, 88, 3);
  ctx.restore();
}

function drawCaught() {
  ctx.save();
  ctx.fillStyle = '#080a12';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  drawQteAnimation(0, 0, VIEW_WIDTH, VIEW_HEIGHT, 1);
  const vignette = ctx.createRadialGradient(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 100, VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 560);
  vignette.addColorStop(0, 'rgba(20,2,9,0.02)');
  vignette.addColorStop(1, 'rgba(20,2,9,0.72)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  const topShade = ctx.createLinearGradient(0, 0, 0, 155);
  topShade.addColorStop(0, 'rgba(8,10,18,0.94)');
  topShade.addColorStop(1, 'rgba(8,10,18,0)');
  ctx.fillStyle = topShade;
  ctx.fillRect(0, 0, VIEW_WIDTH, 170);
  ctx.textAlign = 'center';
  ctx.shadowColor = '#ff4862';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#fffbea';
  ctx.font = '1000 50px Microsoft YaHei';
  ctx.fillText('\u8001\u5b50\u624d\u662f\u8001\u5927\uff01\uff01\uff01', VIEW_WIDTH / 2, 82);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffc94a';
  ctx.font = '1000 25px Microsoft YaHei';
  ctx.fillText(Math.floor(game.distance) + ' m', VIEW_WIDTH / 2, 122);
  ctx.restore();
}

function drawFinishTape() {
  const x = 788;
  ctx.fillStyle = '#171a18';
  ctx.fillRect(x - 6, 132, 12, GROUND_Y - 132);
  ctx.fillRect(x + 126, 132, 12, GROUND_Y - 132);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      ctx.fillStyle = (row + column) % 2 ? '#171a18' : '#f7f4e8';
      ctx.fillRect(x + column * 16, 132 + row * 16, 16, 16);
    }
  }
}

function drawVictory() {
  ctx.save();
  ctx.fillStyle = '#080a12';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  drawImageCover(assets.ending, 0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  const bottomShade = ctx.createLinearGradient(0, 300, 0, VIEW_HEIGHT);
  bottomShade.addColorStop(0, 'rgba(8,10,18,0)');
  bottomShade.addColorStop(0.62, 'rgba(8,10,18,0.88)');
  bottomShade.addColorStop(1, 'rgba(8,10,18,0.98)');
  ctx.fillStyle = bottomShade;
  ctx.fillRect(0, 280, VIEW_WIDTH, VIEW_HEIGHT - 280);
  for (const piece of game.confetti) {
    ctx.save(); ctx.translate(piece.x, piece.y); ctx.rotate(piece.rotation); ctx.fillStyle = piece.color;
    ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.55); ctx.restore();
  }
  ctx.textAlign = 'center';
  ctx.shadowColor = '#955cff';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#fffbea';
  ctx.font = '1000 43px Microsoft YaHei';
  ctx.fillText('\u4e0a\u5427\u4f26\u5bb6\u7684\u9a91\u58eb\uff01\uff01\uff01', VIEW_WIDTH / 2, 474);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#d9ff45';
  roundedRect(ctx, 407, 492, 146, 34, 12);
  ctx.fill();
  ctx.fillStyle = '#10130b';
  ctx.font = '1000 19px Microsoft YaHei';
  ctx.fillText('2000 m', VIEW_WIDTH / 2, 516);
  ctx.restore();
}

function drawScene(timestamp) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.save();
  if (game.shake > 0) {
    ctx.translate(randomBetween(-game.shake, game.shake), randomBetween(-game.shake * 0.55, game.shake * 0.55));
  }

  drawBackground();

  if (game.state === 'victory') {
    drawHud();
    drawVictory();
  } else {
    if (!['ultimate', 'qte', 'counter'].includes(game.state)) {
      drawHud();
    }
    for (const obstacle of game.obstacles) {
      drawObstacle(obstacle);
    }
    if (!['qte', 'counter', 'ultimate', 'caught'].includes(game.state)) {
      drawPursuer(timestamp);
      drawRunner();
    }

    if (game.state === 'ready') {
      drawReady();
    } else if (game.state === 'ultimate') {
      drawUltimate(timestamp);
    } else if (game.state === 'qte') {
      drawQte();
    } else if (game.state === 'counter') {
      drawCounter(timestamp);
    } else if (game.state === 'caught') {
      drawCaught(timestamp);
    } else {
      drawCallout();
    }
  }
  ctx.restore();
}

function gameLoop(timestamp) {
  if (!game.lastTime) {
    game.lastTime = timestamp;
  }
  const dt = Math.min(0.035, Math.max(0, (timestamp - game.lastTime) / 1000));
  game.lastTime = timestamp;
  update(dt);
  drawScene(timestamp);
  window.requestAnimationFrame(gameLoop);
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT,
  };
}

function addQteBurst(hit) {
  const colors = ['#d9ff53', '#ffc84a', '#67d9e8', '#f04f44', '#f7f4e8'];
  for (let index = 0; index < 10; index += 1) {
    const angle = (index / 10) * TAU + Math.random() * 0.3;
    const speed = randomBetween(90, 230);
    game.particles.push({
      x: QTE_CENTER.x,
      y: QTE_CENTER.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randomBetween(0.42, 0.75),
      size: randomBetween(5, 11),
      rotation: angle,
      spin: randomBetween(-8, 8),
      color: colors[(hit + index) % colors.length],
    });
  }
}

function registerQteTap(point) {
  const dx = point.x - QTE_CENTER.x;
  const dy = point.y - QTE_CENTER.y;
  if (Math.hypot(dx, dy) > QTE_RADIUS * 1.14) {
    game.qteMissFlash = 1;
    tone(105, 0.06, 'square', 0.04);
    return;
  }

  game.qteHits += 1;
  game.qtePulse = 1;
  game.shake = Math.min(5, 1 + game.qteHits * 0.16);
  addQteBurst(game.qteHits);
  playQteHitSound(game.qteHits);
  if (game.qteHits >= QTE_REQUIRED_HITS) {
    beginCounter();
  }
}

function primaryAction() {
  if (game.state === 'ready' || game.state === 'caught' || game.state === 'victory') {
    startGame();
  } else if (game.state === 'running') {
    jumpRunner();
  }
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  ensureAudio();
  const point = canvasPoint(event);
  if (game.state === 'qte') {
    registerQteTap(point);
  } else {
    primaryAction();
  }
});

actionButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  primaryAction();
});

soundButton.addEventListener('click', () => {
  ensureAudio();
  setSoundEnabled(!game.soundEnabled);
});

window.addEventListener('keydown', (event) => {
  if (!['Space', 'ArrowUp', 'KeyW'].includes(event.code)) {
    return;
  }
  event.preventDefault();
  if (game.state !== 'qte') {
    primaryAction();
  }
});

window.addEventListener('blur', () => {
  if (audioContext && audioContext.state === 'running') {
    audioContext.suspend().catch(() => {});
  }
});

window.addEventListener('focus', () => {
  if (audioContext && game.soundEnabled) {
    audioContext.resume().catch(() => {});
  }
});

if (new URLSearchParams(window.location.search).has('debug')) {
  window.__gameDebug = {
    snapshot: () => ({
      state: game.state,
      distance: Math.floor(game.distance),
      qteHits: game.qteHits,
      qteTimeLeft: Number(game.qteTimeLeft.toFixed(2)),
      attackTriggered: game.attackTriggered,
      soundEnabled: game.soundEnabled,
    }),
    forceAttack: () => {
      if (game.state === 'ready') {
        startGame();
      }
      game.distance = ULTIMATE_AT_METERS;
      beginUltimate();
    },
    forceQte: () => {
      if (game.state === 'ready') {
        startGame();
      }
      if (game.state === 'running') {
        game.attackTriggered = true;
        game.state = 'ultimate';
      }
      beginQte();
    },
    completeQte: () => {
      if (game.state !== 'qte') {
        return;
      }
      game.qteHits = QTE_REQUIRED_HITS - 1;
      registerQteTap(QTE_CENTER);
    },
    forceCaught: () => beginCaught(),
    forceVictory: () => beginVictory(),
  };
}

setSoundEnabled(true);
document.body.dataset.gameReady = 'true';
window.requestAnimationFrame(gameLoop);

