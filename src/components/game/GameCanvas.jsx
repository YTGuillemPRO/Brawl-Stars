import { useRef, useEffect, useCallback, useState } from 'react';
import {
  ARENA_WIDTH, ARENA_HEIGHT, PLAYER_RADIUS, PROJECTILE_RADIUS,
  generateWalls, checkWallCollision, checkProjectileWallCollision,
  distance, angle, updateAI, createProjectiles
} from '../../lib/gameEngine';
import { BRAWLERS } from '../../lib/brawlers';

const CANVAS_SCALE = 1;

export default function GameCanvas({ selectedBrawler, onGameEnd }) {
  const canvasRef = useRef(null);
  const gameState = useRef(null);
  const keysPressed = useRef({});
  const mousePos = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef(null);
  const [score, setScore] = useState(0);
  const [playerHp, setPlayerHp] = useState(selectedBrawler.hp);
  const [gameOver, setGameOver] = useState(false);
  const [kills, setKills] = useState(0);

  const initGame = useCallback(() => {
    const walls = generateWalls();
    
    // Pick random brawlers for bots
    const botBrawlers = [];
    for (let i = 0; i < 5; i++) {
      botBrawlers.push(BRAWLERS[Math.floor(Math.random() * BRAWLERS.length)]);
    }
    
    const bots = botBrawlers.map((b, i) => {
      let x, y;
      do {
        x = 100 + Math.random() * (ARENA_WIDTH - 200);
        y = 100 + Math.random() * (ARENA_HEIGHT - 200);
      } while (distance(x, y, ARENA_WIDTH / 2, ARENA_HEIGHT - 80) < 150 || checkWallCollision(x, y, PLAYER_RADIUS, walls));
      
      return {
        id: `bot_${i}`,
        x, y,
        hp: b.hp,
        brawler: b,
        lastShot: 0,
        hitFlash: 0,
      };
    });

    gameState.current = {
      player: {
        id: 'player',
        x: ARENA_WIDTH / 2,
        y: ARENA_HEIGHT - 80,
        hp: selectedBrawler.hp,
        brawler: selectedBrawler,
        lastShot: 0,
        hitFlash: 0,
      },
      bots,
      projectiles: [],
      walls,
      particles: [],
      score: 0,
      kills: 0,
      lastTime: Date.now(),
      gameOver: false,
    };
  }, [selectedBrawler]);

  const spawnNewBot = useCallback(() => {
    const gs = gameState.current;
    if (!gs || gs.bots.length >= 5) return;
    
    const b = BRAWLERS[Math.floor(Math.random() * BRAWLERS.length)];
    let x, y;
    const walls = gs.walls;
    do {
      x = 100 + Math.random() * (ARENA_WIDTH - 200);
      y = 50 + Math.random() * (ARENA_HEIGHT / 2);
    } while (checkWallCollision(x, y, PLAYER_RADIUS, walls));
    
    gs.bots.push({
      id: `bot_${Date.now()}_${Math.random()}`,
      x, y,
      hp: b.hp,
      brawler: b,
      lastShot: 0,
      hitFlash: 0,
    });
  }, []);

  const addParticles = useCallback((x, y, color, count) => {
    const gs = gameState.current;
    if (!gs) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 1 + Math.random() * 3;
      gs.particles.push({
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 20 + Math.random() * 20,
        maxLife: 40,
        color,
        size: 2 + Math.random() * 4,
      });
    }
  }, []);

  const gameLoop = useCallback(() => {
    const gs = gameState.current;
    const canvas = canvasRef.current;
    if (!gs || !canvas || gs.gameOver) return;

    const ctx = canvas.getContext('2d');
    const now = Date.now();
    const deltaTime = Math.min(now - gs.lastTime, 50);
    gs.lastTime = now;

    // --- UPDATE ---

    // Player movement
    const player = gs.player;
    let dx = 0, dy = 0;
    if (keysPressed.current['w'] || keysPressed.current['arrowup']) dy -= 1;
    if (keysPressed.current['s'] || keysPressed.current['arrowdown']) dy += 1;
    if (keysPressed.current['a'] || keysPressed.current['arrowleft']) dx -= 1;
    if (keysPressed.current['d'] || keysPressed.current['arrowright']) dx += 1;
    
    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len; dy /= len;
      const newX = player.x + dx * player.brawler.speed * deltaTime * 0.06;
      const newY = player.y + dy * player.brawler.speed * deltaTime * 0.06;
      if (!checkWallCollision(newX, player.y, PLAYER_RADIUS, gs.walls)) {
        player.x = Math.max(PLAYER_RADIUS + 25, Math.min(ARENA_WIDTH - PLAYER_RADIUS - 25, newX));
      }
      if (!checkWallCollision(player.x, newY, PLAYER_RADIUS, gs.walls)) {
        player.y = Math.max(PLAYER_RADIUS + 25, Math.min(ARENA_HEIGHT - PLAYER_RADIUS - 25, newY));
      }
    }

    // Player shoot (auto-fire when mouse is down or space held)
    if (keysPressed.current['mousedown'] || keysPressed.current[' ']) {
      if (now - player.lastShot > player.brawler.attackSpeed) {
        player.lastShot = now;
        const rect = canvas.getBoundingClientRect();
        const mx = (mousePos.current.x - rect.left) * (ARENA_WIDTH / rect.width);
        const my = (mousePos.current.y - rect.top) * (ARENA_HEIGHT / rect.height);
        const aimAngle = angle(player.x, player.y, mx, my);
        gs.projectiles.push(...createProjectiles(player, aimAngle));
      }
    }

    // Update bots
    for (const bot of gs.bots) {
      const newProjectiles = updateAI(bot, player, gs.bots, gs.walls, deltaTime);
      gs.projectiles.push(...newProjectiles);
      if (bot.hitFlash > 0) bot.hitFlash -= deltaTime;
    }
    if (player.hitFlash > 0) player.hitFlash -= deltaTime;

    // Update projectiles
    gs.projectiles = gs.projectiles.filter(p => {
      p.x += p.vx * deltaTime * 0.06;
      p.y += p.vy * deltaTime * 0.06;
      p.distanceTraveled += Math.sqrt(p.vx * p.vx + p.vy * p.vy) * deltaTime * 0.06;

      if (p.distanceTraveled > p.range) return false;
      if (checkProjectileWallCollision(p.x, p.y, gs.walls)) {
        addParticles(p.x, p.y, p.color, 3);
        return false;
      }

      // Check hit on player
      if (p.ownerId !== 'player' && distance(p.x, p.y, player.x, player.y) < PLAYER_RADIUS + PROJECTILE_RADIUS) {
        player.hp -= p.damage;
        player.hitFlash = 150;
        addParticles(p.x, p.y, '#ff4444', 5);
        setPlayerHp(Math.max(0, player.hp));
        if (player.hp <= 0) {
          gs.gameOver = true;
          setGameOver(true);
          onGameEnd({ score: gs.score, kills: gs.kills, won: false });
        }
        return false;
      }

      // Check hit on bots
      for (let i = gs.bots.length - 1; i >= 0; i--) {
        const bot = gs.bots[i];
        if (p.ownerId === bot.id) continue;
        if (p.ownerId !== 'player') continue;
        if (distance(p.x, p.y, bot.x, bot.y) < PLAYER_RADIUS + PROJECTILE_RADIUS) {
          bot.hp -= p.damage;
          bot.hitFlash = 150;
          addParticles(p.x, p.y, bot.brawler.color, 5);
          if (bot.hp <= 0) {
            addParticles(bot.x, bot.y, bot.brawler.color, 15);
            gs.bots.splice(i, 1);
            gs.score += 100;
            gs.kills += 1;
            setScore(gs.score);
            setKills(gs.kills);
            // Heal on kill
            player.hp = Math.min(player.brawler.hp, player.hp + 20);
            setPlayerHp(player.hp);
            setTimeout(() => spawnNewBot(), 2000 + Math.random() * 3000);
          }
          return false;
        }
      }

      return true;
    });

    // Update particles
    gs.particles = gs.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.life -= 1;
      return p.life > 0;
    });

    // --- RENDER ---
    ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Arena floor
    ctx.fillStyle = '#2d5a27';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Grid pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < ARENA_WIDTH; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA_HEIGHT); ctx.stroke();
    }
    for (let y = 0; y < ARENA_HEIGHT; y += 50) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA_WIDTH, y); ctx.stroke();
    }

    // Walls
    for (const wall of gs.walls) {
      if (wall.type === 'bush') {
        ctx.fillStyle = '#1a7a1a';
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
        ctx.fillStyle = 'rgba(0,100,0,0.5)';
        for (let i = 0; i < 4; i++) {
          const bx = wall.x + Math.random() * wall.w;
          const by = wall.y + Math.random() * wall.h;
          ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        ctx.fillStyle = '#5a4a3a';
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
        ctx.strokeStyle = '#4a3a2a';
        ctx.lineWidth = 2;
        ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
        // Brick pattern
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        const brickH = 10;
        for (let y = wall.y; y < wall.y + wall.h; y += brickH) {
          ctx.beginPath(); ctx.moveTo(wall.x, y); ctx.lineTo(wall.x + wall.w, y); ctx.stroke();
        }
      }
    }

    // Particles
    for (const p of gs.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Projectiles
    for (const p of gs.projectiles) {
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, PROJECTILE_RADIUS + 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Draw entities (bots + player)
    const drawEntity = (entity, isPlayer) => {
      const { x, y, hp, brawler, hitFlash } = entity;
      
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(x, y + PLAYER_RADIUS + 3, PLAYER_RADIUS * 0.8, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      const flash = hitFlash > 0;
      ctx.fillStyle = flash ? '#ffffff' : brawler.color;
      ctx.beginPath();
      ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      
      // Outline
      ctx.strokeStyle = isPlayer ? '#ffd700' : '#333';
      ctx.lineWidth = isPlayer ? 3 : 2;
      ctx.stroke();

      // Emoji
      ctx.font = '20px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(brawler.emoji, x, y);

      // HP bar
      const barWidth = 36;
      const barHeight = 5;
      const barY = y - PLAYER_RADIUS - 10;
      const hpPercent = Math.max(0, hp / brawler.hp);
      
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - barWidth / 2 - 1, barY - 1, barWidth + 2, barHeight + 2);
      
      ctx.fillStyle = hpPercent > 0.5 ? '#4ade80' : hpPercent > 0.25 ? '#fbbf24' : '#ef4444';
      ctx.fillRect(x - barWidth / 2, barY, barWidth * hpPercent, barHeight);

      // Name
      if (!isPlayer) {
        ctx.font = 'bold 10px Arial';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(brawler.name, x, barY - 8);
      }
    };

    for (const bot of gs.bots) {
      drawEntity(bot, false);
    }
    drawEntity(player, true);

    // Aim line
    if (canvasRef.current) {
      const rect = canvas.getBoundingClientRect();
      const mx = (mousePos.current.x - rect.left) * (ARENA_WIDTH / rect.width);
      const my = (mousePos.current.y - rect.top) * (ARENA_HEIGHT / rect.height);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(mx, my);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    animFrameRef.current = requestAnimationFrame(gameLoop);
  }, [addParticles, onGameEnd, spawnNewBot]);

  useEffect(() => {
    initGame();
    animFrameRef.current = requestAnimationFrame(gameLoop);

    const handleKeyDown = (e) => {
      keysPressed.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };
    const handleMouseMove = (e) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    };
    const handleMouseDown = (e) => {
      if (e.button === 0) keysPressed.current['mousedown'] = true;
    };
    const handleMouseUp = (e) => {
      if (e.button === 0) keysPressed.current['mousedown'] = false;
    };
    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      mousePos.current = { x: touch.clientX, y: touch.clientY };
      keysPressed.current['mousedown'] = true;
    };
    const handleTouchMove = (e) => {
      const touch = e.touches[0];
      mousePos.current = { x: touch.clientX, y: touch.clientY };
    };
    const handleTouchEnd = () => {
      keysPressed.current['mousedown'] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [initGame, gameLoop]);

  return (
    <div className="relative w-full flex flex-col items-center">
      {/* HUD */}
      <div className="w-full max-w-[800px] flex items-center justify-between px-4 py-2 mb-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{selectedBrawler.emoji}</span>
          <div>
            <div className="font-display text-sm text-foreground">{selectedBrawler.name}</div>
            <div className="w-32 h-3 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full transition-all duration-200 rounded-full"
                style={{ 
                  width: `${(playerHp / selectedBrawler.hp) * 100}%`,
                  backgroundColor: playerHp / selectedBrawler.hp > 0.5 ? '#4ade80' : playerHp / selectedBrawler.hp > 0.25 ? '#fbbf24' : '#ef4444'
                }}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="font-display text-xl text-primary">{kills}</div>
            <div className="text-xs text-muted-foreground">Kills</div>
          </div>
          <div className="text-center">
            <div className="font-display text-xl text-primary">{score}</div>
            <div className="text-xs text-muted-foreground">Puntos</div>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={ARENA_WIDTH}
        height={ARENA_HEIGHT}
        className="rounded-xl border-2 border-border w-full max-w-[800px] cursor-crosshair"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* Game Over overlay */}
      {gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-xl">
          <div className="text-center space-y-4">
            <div className="font-display text-4xl text-destructive">¡DERROTADO!</div>
            <div className="text-foreground text-lg">
              Kills: <span className="text-primary font-bold">{kills}</span> · 
              Puntos: <span className="text-primary font-bold">{score}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
