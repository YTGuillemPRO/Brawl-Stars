import { RARITY_COLORS } from '../../lib/brawlers';
import { motion } from 'framer-motion';

export default function BrawlerCard({ brawler, selected, onClick }) {
  const rarity = RARITY_COLORS[brawler.rarity];
  
  return (
    <motion.button
      whileHover={{ scale: 1.05, y: -4 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`
        relative w-full rounded-xl p-3 text-left transition-all duration-200
        ${selected 
          ? 'ring-2 ring-primary shadow-lg shadow-primary/20' 
          : 'ring-1 ring-border hover:ring-muted-foreground/30'}
      `}
      style={{ 
        background: selected 
          ? `linear-gradient(135deg, ${brawler.color}22, ${brawler.color}08)` 
          : 'hsl(var(--card))' 
      }}
    >
      {/* Rarity badge */}
      <div 
        className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white"
        style={{ backgroundColor: rarity.bg }}
      >
        {rarity.label}
      </div>

      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div 
          className="w-14 h-14 rounded-lg flex items-center justify-center text-3xl shrink-0"
          style={{ backgroundColor: brawler.color + '30', border: `2px solid ${brawler.color}` }}
        >
          {brawler.emoji}
        </div>

        {/* Info */}
        <div className="min-w-0">
          <div className="font-display text-base text-foreground truncate">{brawler.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{brawler.description}</div>
          
          {/* Stats */}
          <div className="flex gap-3 mt-2">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-green-400">❤️</span>
              <span className="text-[11px] font-bold text-foreground">{brawler.hp}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-red-400">⚔️</span>
              <span className="text-[11px] font-bold text-foreground">{brawler.damage}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-blue-400">💨</span>
              <span className="text-[11px] font-bold text-foreground">{brawler.speed}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.button>
  );
}
