import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EV2_TRANSITIONS } from "./motion";

export default function RouteTransition({ routeKey, children }) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : EV2_TRANSITIONS.fast;

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={routeKey}
        className="ev2-route-transition"
        data-route-key={routeKey}
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -2 }}
        transition={transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
