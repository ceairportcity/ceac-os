import { createContext } from 'react';

// Presentation only. Auth, capabilities and record authority stay with the
// existing server-verified actor. React context follows drawers through portals.
export const RolePresentationContext = createContext(null);
