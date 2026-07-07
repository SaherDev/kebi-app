import Svg, { Ellipse, Circle, Path, G } from 'react-native-svg';
import { MASCOT } from '../theme/palette';

interface MascotProps {
  /** Rendered width/height in px. The art is authored on a 64×64 viewBox. */
  size?: number;
}

/**
 * Kebi mascot — the round greeting bird. Ported verbatim from
 * docs/kebi-app-design-system/kebi-tokens-mockup.html §17 (`.mascot-large`).
 * Colors are static across light/dark (the bird keeps its own palette) and come
 * from `MASCOT` in src/theme/palette.ts — no hex literals live in this file.
 */
export function Mascot({ size = 36 }: MascotProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {/* body + belly */}
      <Ellipse cx={32} cy={38} rx={20} ry={20} fill={MASCOT.body} />
      <Ellipse cx={32} cy={42} rx={13} ry={13} fill={MASCOT.belly} />
      {/* wings raised in greeting */}
      <Ellipse cx={13} cy={34} rx={3.5} ry={6} fill={MASCOT.wings} transform="rotate(-25 13 34)" />
      <Ellipse cx={51} cy={34} rx={3.5} ry={6} fill={MASCOT.wings} transform="rotate(25 51 34)" />
      {/* cheeks */}
      <Ellipse cx={22} cy={36} rx={3} ry={2} fill={MASCOT.cheek} opacity={MASCOT.cheekOpacity} />
      <Ellipse cx={42} cy={36} rx={3} ry={2} fill={MASCOT.cheek} opacity={MASCOT.cheekOpacity} />
      {/* eyes — whites, pupils, catch-lights */}
      <Circle cx={25} cy={30} r={3.5} fill={MASCOT.eye} />
      <Circle cx={39} cy={30} r={3.5} fill={MASCOT.eye} />
      <Circle cx={25} cy={30} r={1.7} fill={MASCOT.pupil} />
      <Circle cx={39} cy={30} r={1.7} fill={MASCOT.pupil} />
      <Circle cx={25.6} cy={29.4} r={0.6} fill={MASCOT.eye} />
      <Circle cx={39.6} cy={29.4} r={0.6} fill={MASCOT.eye} />
      {/* beak + head tuft */}
      <Path d="M30 33 L34 33 L32 36 Z" fill={MASCOT.beak} />
      <G>
        <Path
          d="M30 14 Q32 10 34 14"
          stroke={MASCOT.tuft}
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}
