import { Stagger } from '@/motion';
import { Aside } from './Layout';
import './dashboard.css';
import { Feed } from './Feed';
import { Hero } from './Hero';
import { Performance } from './Performance';
import { Radar } from './Radar';
import { RiskSummary } from './RiskSummary';

/** Dashboard (FE-05): briefing, position radar, performance vs S&P 500, risk summary, ranked feed, side panels. */
export default function Screen() {
  return (
    <div data-testid="screen-dashboard" style={{ display: 'grid', gap: 24 }}>
      <Stagger style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <Hero />
        <Radar />
      </Stagger>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ flex: '2 1 480px', minWidth: 0 }}>
          <Performance />
        </div>
        <div style={{ flex: '1 1 300px', minWidth: 0 }}>
          <RiskSummary />
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,360px),1fr))',
          gap: 24,
          alignItems: 'start',
        }}
      >
        <Feed />
        <Aside />
      </div>
    </div>
  );
}
