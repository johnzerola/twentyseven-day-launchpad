import { motion } from 'framer-motion';

interface YouTubePlayIconProps {
  className?: string;
  size?: number;
  opacity?: number;
  animate?: boolean;
}

export const YouTubePlayIcon = ({ className = '', size = 40, opacity = 0.06, animate = true }: YouTubePlayIconProps) => {
  const Wrapper = animate ? motion.div : 'div' as any;
  const animateProps = animate ? {
    animate: { y: [0, -8, 0], rotate: [0, 3, -3, 0] },
    transition: { duration: 6 + Math.random() * 4, repeat: Infinity, ease: 'easeInOut' },
  } : {};

  return (
    <Wrapper className={`pointer-events-none select-none ${className}`} style={{ opacity }} {...animateProps}>
      <svg width={size} height={size} viewBox="0 0 68 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M66.52 7.74C65.77 4.81 63.48 2.52 60.55 1.77C55.22 0.27 34 0.27 34 0.27S12.78 0.27 7.45 1.77C4.52 2.52 2.23 4.81 1.48 7.74C0 13.09 0 24.13 0 24.13S0 35.17 1.48 40.52C2.23 43.45 4.52 45.74 7.45 46.49C12.78 47.99 34 47.99 34 47.99S55.22 47.99 60.55 46.49C63.48 45.74 65.77 43.45 66.52 40.52C68 35.17 68 24.13 68 24.13S68 13.09 66.52 7.74Z" fill="hsl(var(--youtube-red))"/>
        <path d="M27.16 34.33L44.84 24.13L27.16 13.93V34.33Z" fill="white"/>
      </svg>
    </Wrapper>
  );
};

export const FloatingYouTubeIcons = () => {
  const positions = [
    { top: '8%', left: '5%', size: 48, opacity: 0.04, delay: 0 },
    { top: '15%', right: '8%', size: 36, opacity: 0.05, delay: 1 },
    { top: '35%', left: '3%', size: 28, opacity: 0.03, delay: 2 },
    { top: '50%', right: '4%', size: 44, opacity: 0.04, delay: 0.5 },
    { top: '65%', left: '7%', size: 32, opacity: 0.05, delay: 1.5 },
    { top: '75%', right: '10%', size: 24, opacity: 0.03, delay: 3 },
    { top: '88%', left: '12%', size: 40, opacity: 0.04, delay: 2.5 },
    { top: '92%', right: '6%', size: 30, opacity: 0.03, delay: 1 },
  ];

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {positions.map((pos, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ top: pos.top, left: (pos as any).left, right: (pos as any).right }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: pos.delay, duration: 1 }}
        >
          <YouTubePlayIcon size={pos.size} opacity={pos.opacity} />
        </motion.div>
      ))}
    </div>
  );
};
