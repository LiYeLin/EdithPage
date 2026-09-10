import { createContext } from 'react'
import type { Arrival } from './liquidSession'

// Keep the sensor list stable across editing/drawer changes; disable its targets instead.
export const SiteDragEnabledContext = createContext(false)

// The tile keeps its layout box while the visual layer travels to its real icon.
export const PendingArrivalContext = createContext<Arrival | null>(null)

export const ArrivalFeedbackContext = createContext<Arrival | null>(null)
