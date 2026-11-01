import { Stagger } from '@/motion';
import { Movers, PilotActivity, Upcoming } from './Aside';

/** Right-hand column: Pilot activity, watchlist movers, upcoming events. */
export function Aside() {
  return (
    <Stagger as="aside" style={{ display: 'grid', gap: 24 }} aria-label="Side panels">
      <PilotActivity />
      <Movers />
      <Upcoming />
    </Stagger>
  );
}
