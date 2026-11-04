import { motion, useReducedMotion } from "motion/react";
import { EV2_TRANSITIONS } from "./motion";

export default function RouteTransition({ routeKey, children }) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : EV2_TRANSITIONS.fast;

  // One destination at a time. Animate entry, but unmount the previous page
  // immediately so a pending exit cannot block navigation.
  return (
    <motion.div
      key={routeKey}
      className="ev2-route-transition"
      data-route-key={routeKey}
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}
