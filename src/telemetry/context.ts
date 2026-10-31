import { createContext } from 'react';
import type { Tracker } from './tracker';

export const TrackerContext = createContext<Tracker | null>(null);
