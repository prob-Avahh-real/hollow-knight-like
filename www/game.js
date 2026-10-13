const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const messageElement = document.getElementById('message');
const stateElement = document.getElementById('state');
const healthElement = document.getElementById('health');
const soulElement = document.getElementById('soul');
const levelElement = document.getElementById('level');
const abilityElement = document.getElementById('ability');
const platformElement = document.getElementById('platform');
const saveElement = document.getElementById('save-status');
const instructionsElement = document.getElementById('instructions');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const TILE = 48;
const GRAVITY = 0.82;
const MAX_HEALTH = 5;

const levels = [
  {
    map: [
      '.............................',
      '.............................',
      '.............................',
      '.............................',
      '.............=...............',
      '.........===..===............',
      '.............................',
      '....===...................===',
      '.............................',
      '......===............===.....',
      '.............................',
      '..=====......................',
      '.............................',
      '##########################..#',
      '##########################..#'
    ],
    enemies: [
      { type: 'walker', x: 520, y: 280, distance: 120 },
      { type: 'walker', x: 760, y: 150, distance: 80 }
    ]
  },
  {
    map: [
      '...............................',
      '...............................',
      '...............................',
      '.............==...............',
      '......===.....................',
      '...........................==.',
      '....==.....^^.............===',
      '..........^^^................',
      '......===.......===..........',
      '.............................',
      '..======..............==.....',
      '.............................',
      '##########################..G',
      '##########################..G'
    ],
    enemies: [
      { type: 'walker', x: 460, y: 300, distance: 150 },
      { type: 'flyer', x: 660, y: 120, distance: 180 }
    ]
  },
  {
    map: [
      '................................',
      '................................',
      '................................',
      '.............=........G........',
      '.........===..===.............',
      '..........^^..................',
      '....===....^^....===..........',
      '..............................',
      '..=====.............=====.....',
      '..............................',
      '............===...............',
      '..............................',
      '##########################....',
      '##########################....'
    ],
    enemies: [
      { type: 'charger', x: 500, y: 300, distance: 100 },
      { type: 'flyer', x: 720, y: 180, distance: 160 },
      { type: 'walker', x: 300, y: 300, distance: 90 }
    ]
  }
];

let currentLevel = 0;
let map = levels[currentLevel].map;
let gameState = 'menu';
let lastTimestamp = 0;
let camera = { x: 0, y: 0 };

const input = { left: false, right: false, jump: false, attack: false, dash: false };
const particles = [];
const enemies = [];
let levelMessageTimeout = null;
let usingGamepad = false;
let gamepadIndex = null;
let audioContext = null;
let selectedLevel = 0;
let menuInitialized = false;
const menuOverlay = document.getElementById('menu-overlay');
const startButton = document.getElementById('start-button');
const continueButton = document.getElementById('continue-button');
const resetSaveButton = document.getElementById('reset-save-button');
const levelButtons = document.querySelectorAll('.level-button');

function getPlatformName() {
  const ua = navigator.userAgent;
  if (/PlayStation|PS4|PS5/.test(ua)) return 'PlayStation';
  if (/Nintendo Switch|Switch/.test(ua)) return 'Switch';
  if (/Xbox/.test(ua)) return 'Xbox / Game Pass';
  if (/Mac/.test(navigator.platform)) return 'MacOS';
  if (/Win/.test(navigator.platform)) return 'Windows';
  if (/Linux/.test(navigator.platform)) return 'Linux';
  return '浏览器';
}

function updatePlatformLabel() {
  if (platformElement) {
    platformElement.textContent = `平台: ${getPlatformName()}`;
  }
}

function getControllerLabels() {
  const platform = getPlatformName();
  if (platform === 'PlayStation') {
    return { jump: 'X', attack: 'O', dash: '□', move: '左摇杆 / D-Pad' };
  }
  if (platform === 'Switch') {
    return { jump: 'B', attack: 'A', dash: 'Y', move: '左摇杆 / D-Pad' };
  }
  if (platform.startsWith('Xbox')) {
    return { jump: 'A', attack: 'B', dash: 'X', move: '左摇杆 / D-Pad' };
  }
  return { jump: 'A', attack: 'B', dash: 'X', move: '左摇杆 / D-Pad' };
}

function updateInstructions() {
  if (!instructionsElement) return;
  if (usingGamepad) {
    const labels = getControllerLabels();
    instructionsElement.textContent = `${labels.move} 移动，${labels.jump} 跳跃，${labels.dash} 冲刺，${labels.attack} 攻击。`;
  } else if (isTouchDevice()) {
    instructionsElement.textContent = '触摸按钮控制：左右移动、跳跃、攻击、冲刺。';
  } else {
    instructionsElement.textContent = '← → 移动，Z 跳跃，C 冲刺，X 攻击。支持手柄控制。';
  }
}

function ensureAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playTone(freq, duration = 0.08, type = 'sine') {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  ensureAudio();
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = 0.12;
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start();
  osc.stop(audioContext.currentTime + duration);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
}

function playSound(eventType) {
  if (eventType === 'jump') {
    playTone(420, 0.08, 'triangle');
  } else if (eventType === 'attack') {
    playTone(260, 0.05, 'square');
  } else if (eventType === 'hit') {
    playTone(140, 0.06, 'sawtooth');
  } else if (eventType === 'goal') {
    playTone(680, 0.16, 'triangle');
    setTimeout(() => playTone(860, 0.12, 'triangle'), 90);
  } else if (eventType === 'level') {
    playTone(520, 0.1, 'triangle');
  }
}

function vibrate(pattern) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function updateSaveLabel() {
  if (!saveElement) return;
  saveElement.textContent = `存档: ${currentLevel + 1} / ${levels.length}`;
}

function loadSavedState() {
  try {
    const raw = localStorage.getItem('hollowwood-save');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data.currentLevel === 'number' && data.currentLevel >= 0 && data.currentLevel < levels.length) {
      currentLevel = data.currentLevel;
      selectedLevel = currentLevel;
      player.soul = Number(data.soul || 0);
      highlightSelectedLevel();
      showMessage(`已加载存档，第 ${currentLevel + 1} 关。`, '#b8f8c9');
      clearTimeout(levelMessageTimeout);
      levelMessageTimeout = setTimeout(resetMessage, 2200);
    }
  } catch (error) {
    console.warn('载入存档失败', error);
  }
}

function resetSavedState() {
  localStorage.removeItem('hollowwood-save');
  currentLevel = 0;
  selectedLevel = 0;
  player.soul = 0;
  highlightSelectedLevel();
  updateSaveLabel();
  showMessage('存档已重置', '#8ce2ff');
  clearTimeout(levelMessageTimeout);
  levelMessageTimeout = setTimeout(resetMessage, 1800);
}

function highlightSelectedLevel() {
  levelButtons.forEach(button => {
    const levelIndex = Number(button.dataset.level);
    button.classList.toggle('active', levelIndex === selectedLevel);
  });
}

function saveGame() {
  try {
    const data = { currentLevel, soul: player.soul };
    localStorage.setItem('hollowwood-save', JSON.stringify(data));
    updateSaveLabel();
  } catch (error) {
    console.warn('存档失败', error);
  }
}

function setupTouchControls() {
  const buttons = document.querySelectorAll('.touch-button');
  buttons.forEach(button => {
    const action = button.dataset.action;
    const activate = () => { input[action] = true; };
    const deactivate = () => { input[action] = false; };

    button.addEventListener('touchstart', event => { event.preventDefault(); activate(); }, { passive: false });
    button.addEventListener('touchend', event => { event.preventDefault(); deactivate(); }, { passive: false });
    button.addEventListener('mousedown', event => { event.preventDefault(); activate(); });
    button.addEventListener('mouseup', event => { event.preventDefault(); deactivate(); });
    button.addEventListener('mouseleave', deactivate);
  });
}

function initializeMenu() {
  if (menuInitialized) return;
  menuInitialized = true;
  levelButtons.forEach(button => {
    button.addEventListener('click', () => {
      selectedLevel = Number(button.dataset.level);
      highlightSelectedLevel();
    });
  });
  startButton.addEventListener('click', () => {
    menuOverlay.classList.add('hidden');
    currentLevel = selectedLevel;
    loadLevel(currentLevel);
    gameState = 'playing';
    showMessage(`开始第 ${currentLevel + 1} 关`, '#b8f8c9');
    playSound('level');
  });
  continueButton.addEventListener('click', () => {
    loadSavedState();
    menuOverlay.classList.add('hidden');
    currentLevel = selectedLevel;
    loadLevel(currentLevel);
    gameState = 'playing';
    showMessage(`继续第 ${currentLevel + 1} 关`, '#b8f8c9');
  });
  resetSaveButton.addEventListener('click', () => {
    resetSavedState();
  });
}

function showMenu() {
  if (menuOverlay) {
    menuOverlay.classList.remove('hidden');
  }
}

function resizeCanvas() {
  const container = canvas.parentElement;
  if (!container) return;
  const scale = Math.min(container.clientWidth / WIDTH, container.clientHeight / HEIGHT, 1);
  canvas.style.transform = `scale(${scale})`;
  canvas.style.transformOrigin = 'top left';
}

function pollGamepad() {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (let i = 0; i < gamepads.length; i += 1) {
    const gp = gamepads[i];
    if (gp && gp.connected) {
      usingGamepad = true;
      gamepadIndex = i;
      return gp;
    }
  }
  usingGamepad = false;
  gamepadIndex = null;
  return null;
}

function updateGamepadState() {
  const gp = pollGamepad();
  if (!gp) return;

  const deadzone = 0.3;
  const axisX = gp.axes[0] || 0;
  const left = axisX < -deadzone || gp.buttons[14]?.pressed;
  const right = axisX > deadzone || gp.buttons[15]?.pressed;

  input.left = left;
  input.right = right;
  input.jump = gp.buttons[0]?.pressed || gp.buttons[1]?.pressed;
  input.attack = gp.buttons[1]?.pressed || gp.buttons[2]?.pressed;
  input.dash = gp.buttons[2]?.pressed || gp.buttons[3]?.pressed;
}

class Entity {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
  }

  get left() { return this.x; }
  get right() { return this.x + this.w; }
  get top() { return this.y; }
  get bottom() { return this.y + this.h; }

  intersects(target) {
    return this.left < target.right && this.right > target.left && this.top < target.bottom && this.bottom > target.top;
  }
}

class Player extends Entity {
  constructor(x, y) {
    super(x, y, 34, 44);
    this.health = MAX_HEALTH;
    this.soul = 0;
    this.facing = 1;
    this.attackCooldown = 0;
    this.jumpPressed = false;
    this.dashPressed = false;
    this.dashCooldown = 0;
    this.canDoubleJump = true;
  }

  update(dt) {
    if (input.left) {
      this.vx = Math.max(this.vx - 0.34, -6.5);
      this.facing = -1;
    } else if (input.right) {
      this.vx = Math.min(this.vx + 0.34, 6.5);
      this.facing = 1;
    } else {
      this.vx *= 0.80;
      if (Math.abs(this.vx) < 0.12) this.vx = 0;
    }

    if (input.jump && !this.jumpPressed) {
      if (this.onGround) {
        this.vy = -14.2;
        this.onGround = false;
        this.canDoubleJump = true;
      } else if (this.canDoubleJump) {
        this.vy = -12.5;
        this.canDoubleJump = false;
        createParticle(this.x + this.w / 2, this.y + this.h / 2);
      }
      this.jumpPressed = true;
    }
    if (!input.jump) {
      this.jumpPressed = false;
    }

    if (input.dash && !this.dashPressed && this.dashCooldown <= 0) {
      this.dash();
      this.dashPressed = true;
    }
    if (!input.dash) {
      this.dashPressed = false;
    }

    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }
    if (this.dashCooldown > 0) {
      this.dashCooldown -= dt;
    }

    this.vy += GRAVITY;
    this.x += this.vx;
    this.resolveCollisions('horizontal');
    this.y += this.vy;
    this.resolveCollisions('vertical');

    if (this.onGround) {
      this.canDoubleJump = true;
    }
  }

  dash() {
    this.vx = this.facing * 18;
    this.dashCooldown = 0.72;
    for (let i = 0; i < 5; i += 1) {
      createParticle(this.x + this.w / 2, this.y + this.h / 2);
    }
  }

  resolveCollisions(axis) {
    const collisions = tileHits(this);
    if (!collisions.length) return;
    collisions.forEach(tile => {
      if (axis === 'horizontal') {
        if (this.vx > 0) {
          this.x = tile.left - this.w;
        } else if (this.vx < 0) {
          this.x = tile.right;
        }
        this.vx = 0;
      } else {
        if (this.vy > 0) {
          this.y = tile.top - this.h;
          this.onGround = true;
        } else if (this.vy < 0) {
          this.y = tile.bottom;
        }
        this.vy = 0;
      }
    });
  }

  attack(enemies) {
    if (this.attackCooldown > 0) return;
    this.attackCooldown = 0.18;
    const attackRange = {
      left: { x: this.x - 48, y: this.y, w: 48, h: this.h },
      right: { x: this.x + this.w, y: this.y, w: 48, h: this.h }
    }[this.facing === 1 ? 'right' : 'left'];

    enemies.forEach(enemy => {
      if (enemy.alive && rectIntersect(attackRange, enemy)) {
        enemy.takeDamage();
        this.soul += 1;
        createParticle(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
        saveGame();
      }
    });
  }

  draw() {
    ctx.save();
    ctx.translate(this.x - camera.x, this.y - camera.y);
    ctx.fillStyle = '#d3c3a6';
    ctx.shadowColor = 'rgba(173, 177, 255, 0.35)';
    ctx.shadowBlur = 18;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.fillStyle = '#2a2a34';
    ctx.fillRect(6, 12, 22, 22);
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(this.facing === 1 ? 20 : 8, 18, 10, 10);
    ctx.restore();
  }
}

class Enemy extends Entity {
  constructor(x, y, patrolDistance) {
    super(x, y, 36, 36);
    this.health = 2;
    this.alive = true;
    this.direction = 1;
    this.speed = 1.4;
    this.startX = x;
    this.patrolDistance = patrolDistance;
  }

  update(dt) {
    if (!this.alive) return;
    this.vx = this.speed * this.direction;
    this.x += this.vx;
    this.resolveCollisions();
    if (Math.abs(this.x - this.startX) > this.patrolDistance) {
      this.direction *= -1;
    }
  }

  resolveCollisions() {
    const collisions = tileHits(this);
    collisions.forEach(tile => {
      if (this.vx > 0) {
        this.x = tile.left - this.w;
      } else if (this.vx < 0) {
        this.x = tile.right;
      }
      this.direction *= -1;
    });
  }

  takeDamage() {
    this.health -= 1;
    if (this.health <= 0) {
      this.alive = false;
    }
  }

  draw() {
    if (!this.alive) return;
    ctx.save();
    ctx.translate(this.x - camera.x, this.y - camera.y);
    ctx.fillStyle = '#6d91b1';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.fillStyle = '#1a1f28';
    ctx.fillRect(8, 8, 20, 20);
    ctx.restore();
  }
}

class FlyingEnemy extends Enemy {
  constructor(x, y, patrolDistance) {
    super(x, y, patrolDistance);
    this.w = 32;
    this.h = 32;
    this.speed = 1.2;
    this.heightOffset = y;
    this.flightPhase = 0;
  }

  update(dt) {
    if (!this.alive) return;
    this.flightPhase += dt * 2;
    this.y = this.heightOffset + Math.sin(this.flightPhase) * 12;
    this.vx = this.speed * this.direction;
    this.x += this.vx;
    if (Math.abs(this.x - this.startX) > this.patrolDistance) {
      this.direction *= -1;
    }
  }

  draw() {
    if (!this.alive) return;
    ctx.save();
    ctx.translate(this.x - camera.x, this.y - camera.y);
    ctx.fillStyle = '#9a8cff';
    ctx.beginPath();
    ctx.ellipse(this.w / 2, this.h / 2, this.w / 2, this.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#efe7ff';
    ctx.fillRect(10, 10, 12, 12);
    ctx.restore();
  }
}

class ChargerEnemy extends Enemy {
  constructor(x, y, patrolDistance) {
    super(x, y, patrolDistance);
    this.speed = 2.2;
    this.chargeTimer = 0;
  }

  update(dt) {
    if (!this.alive) return;
    this.chargeTimer += dt;
    if (this.chargeTimer > 1.5) {
      this.direction = player.x > this.x ? 1 : -1;
      this.speed = 3.2;
      this.chargeTimer = 0;
    }
    this.vx = this.speed * this.direction;
    this.x += this.vx;
    this.resolveCollisions();
    if (Math.abs(this.x - this.startX) > this.patrolDistance) {
      this.direction *= -1;
      this.speed = 1.8;
    }
  }

  draw() {
    if (!this.alive) return;
    ctx.save();
    ctx.translate(this.x - camera.x, this.y - camera.y);
    ctx.fillStyle = '#f27a4d';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.fillStyle = '#2b160f';
    ctx.fillRect(6, 6, 24, 24);
    ctx.restore();
  }
}

class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.life = 0.4;
    this.vx = (Math.random() - 0.5) * 180;
    this.vy = (Math.random() - 0.5) * 180;
  }

  update(dt) {
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw() {
    const alpha = Math.max(0, this.life / 0.4);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillRect(this.x - camera.x, this.y - camera.y, 4, 4);
  }
}

const player = new Player(80, 160);
let goalReached = false;

function rectIntersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function tileAt(col, row) {
  if (row < 0 || row >= map.length || col < 0 || col >= map[0].length) return '.';
  return map[row][col];
}

function tileHits(entity) {
  const hits = [];
  const left = Math.floor((entity.left + 1) / TILE);
  const right = Math.floor((entity.right - 1) / TILE);
  const top = Math.floor((entity.top + 1) / TILE);
  const bottom = Math.floor((entity.bottom - 1) / TILE);

  for (let row = top; row <= bottom; row += 1) {
    for (let col = left; col <= right; col += 1) {
      const ch = tileAt(col, row);
      if (ch === '#' || ch === '=') {
        hits.push({ left: col * TILE, top: row * TILE, right: col * TILE + TILE, bottom: row * TILE + TILE });
      }
    }
  }
  return hits;
}

function isHazardTile(col, row) {
  return tileAt(col, row) === '^';
}

function loadLevel(index) {
  currentLevel = index;
  map = levels[currentLevel].map;
  enemies.length = 0;
  levels[currentLevel].enemies.forEach(cfg => {
    if (cfg.type === 'walker') {
      enemies.push(new Enemy(cfg.x, cfg.y, cfg.distance));
    } else if (cfg.type === 'flyer') {
      enemies.push(new FlyingEnemy(cfg.x, cfg.y, cfg.distance));
    } else if (cfg.type === 'charger') {
      enemies.push(new ChargerEnemy(cfg.x, cfg.y, cfg.distance));
    }
  });
  player.x = 80;
  player.y = 160;
  player.vx = 0;
  player.vy = 0;
  player.health = Math.max(1, player.health);
  player.onGround = false;
  goalReached = false;
  updateCamera();
  updatePlatformLabel();
  updateInstructions();
  updateSaveLabel();
  saveGame();
  showMessage(`进入第 ${currentLevel + 1} 关`, '#b8f8c9');
  clearTimeout(levelMessageTimeout);
  levelMessageTimeout = setTimeout(resetMessage, 1600);
}

function updateCamera() {
  const levelWidth = map[0].length * TILE;
  const levelHeight = map.length * TILE;
  camera.x = Math.min(Math.max(player.x + player.w / 2 - WIDTH / 2, 0), Math.max(0, levelWidth - WIDTH));
  camera.y = Math.min(Math.max(player.y + player.h / 2 - HEIGHT / 2, 0), Math.max(0, levelHeight - HEIGHT));
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, '#080b11');
  gradient.addColorStop(1, '#0d1330');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (let i = 0; i < 80; i++) {
    const alpha = 0.02 + Math.sin(i * 0.7) * 0.02;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    const x = ((i * 13) + camera.x * 0.2) % WIDTH;
    const y = (i * 43 + camera.y * 0.1) % HEIGHT;
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawMap() {
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  const columns = map[0].length;
  for (let row = 0; row < map.length; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const tile = map[row][col];
      if (tile !== '.') {
        const x = col * TILE;
        const y = row * TILE;
        if (tile === '#') {
          ctx.fillStyle = '#272f3f';
          ctx.fillRect(x, y, TILE, TILE);
        } else if (tile === '=') {
          ctx.fillStyle = '#2f3f57';
          ctx.fillRect(x, y, TILE, TILE / 2);
        } else if (tile === '^') {
          ctx.fillStyle = '#c1483d';
          ctx.beginPath();
          ctx.moveTo(x, y + TILE);
          ctx.lineTo(x + TILE / 2, y);
          ctx.lineTo(x + TILE, y + TILE);
          ctx.closePath();
          ctx.fill();
        } else if (tile === 'G') {
          ctx.fillStyle = '#ffa84a';
          ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
          ctx.fillStyle = '#ffe7bd';
          ctx.fillRect(x + 14, y + 14, TILE - 28, TILE - 28);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        if (tile !== '^') ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
      }
    }
  }
  ctx.restore();
}

function createParticle(x, y) {
  for (let i = 0; i < 8; i += 1) {
    particles.push(new Particle(x, y));
  }
}

function showMessage(text, color = '#ffeb9f') {
  messageElement.textContent = text;
  messageElement.style.color = color;
}

function resetMessage() {
  messageElement.textContent = '';
}

function updateHud() {
  healthElement.textContent = `生命: ${player.health}`;
  soulElement.textContent = `灵魂: ${player.soul}`;
  levelElement.textContent = `关卡: ${currentLevel + 1}`;
  abilityElement.textContent = `技能: 双跳 / 冲刺`;
  stateElement.textContent = `状态: ${gameState === 'playing' ? '战斗中' : gameState === 'win' ? '胜利' : gameState === 'over' ? '失败' : '准备中'}`;
}

function gameOver(reason) {
  gameState = 'over';
  showMessage(reason, '#ff6e6e');
}

function nextLevel() {
  if (currentLevel < levels.length - 1) {
    loadLevel(currentLevel + 1);
    gameState = 'playing';
    return;
  }
  showMessage('你穿越了全部洞穴，最终胜利！', '#b8f8c9');
  gameState = 'win';
}

function update(dt) {
  if (gameState !== 'playing') return;
  updateGamepadState();
  updateInstructions();
  player.update(dt);
  enemies.forEach(enemy => enemy.update(dt));

  enemies.forEach(enemy => {
    if (enemy.alive && enemy.intersects(player) && Math.abs(player.x - enemy.x) < 36) {
      if (!goalReached) {
        player.health -= 1;
        enemy.direction *= -1;
        player.x -= player.facing * 18;
        createParticle(player.x + player.w / 2, player.y + player.h / 2);
        playSound('hit');
        vibrate([20, 30, 20]);
      }
      if (player.health <= 0) {
        gameOver('你被击败了。');
      }
    }
  });

  if (input.attack && player.attackCooldown <= 0) {
    player.attack(enemies);
  }

  particles.forEach((particle, index) => {
    particle.update(dt);
    if (particle.life <= 0) {
      particles.splice(index, 1);
    }
  });

  if (checkGoal()) {
    goalReached = true;
    showMessage('到达目标门！准备进入下一关...', '#b8f8c9');
    setTimeout(nextLevel, 1400);
  }
  updateCamera();
}

function checkGoal() {
  const col = Math.floor((player.x + player.w / 2) / TILE);
  const row = Math.floor((player.y + player.h / 2) / TILE);
  return tileAt(col, row) === 'G';
}

function draw() {
  drawBackground();
  drawMap();
  enemies.forEach(enemy => enemy.draw());
  player.draw();
  particles.forEach(particle => particle.draw());
}

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.042);
  lastTimestamp = timestamp;

  if (gameState === 'menu') {
    loadSavedState();
    highlightSelectedLevel();
    updatePlatformLabel();
    updateInstructions();
    updateSaveLabel();
    setupTouchControls();
    initializeMenu();
    resizeCanvas();
    showMenu();
  }

  update(dt);
  draw();
  updateHud();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', event => {
  if (event.code === 'ArrowLeft') input.left = true;
  if (event.code === 'ArrowRight') input.right = true;
  if (event.code === 'KeyZ') input.jump = true;
  if (event.code === 'KeyX') input.attack = true;
  if (event.code === 'KeyC') input.dash = true;
});

window.addEventListener('keyup', event => {
  if (event.code === 'ArrowLeft') input.left = false;
  if (event.code === 'ArrowRight') input.right = false;
  if (event.code === 'KeyZ') input.jump = false;
  if (event.code === 'KeyX') input.attack = false;
  if (event.code === 'KeyC') input.dash = false;
});

window.addEventListener('gamepadconnected', event => {
  usingGamepad = true;
  gamepadIndex = event.gamepad.index;
  updateInstructions();
  updatePlatformLabel();
  showMessage('手柄已连接，已切换到控制器模式。', '#b8f8c9');
  clearTimeout(levelMessageTimeout);
  levelMessageTimeout = setTimeout(resetMessage, 1800);
});

window.addEventListener('gamepaddisconnected', event => {
  if (gamepadIndex === event.gamepad.index) {
    usingGamepad = false;
    gamepadIndex = null;
  }
  updateInstructions();
  showMessage('手柄已断开，返回键盘控制。', '#ffb86c');
  clearTimeout(levelMessageTimeout);
  levelMessageTimeout = setTimeout(resetMessage, 1800);
});

requestAnimationFrame(loop);
