import {minify} from 'csso';

// CSSO 5 silently discards modern media-range rules. Fail the build if the
// supported single-pass input contract changes, rather than shipping no phone CSS.
export function minifyProductionCss(source) {
  if (/@media[^{}]*[<>]/i.test(source))
    throw new Error('Unsupported media-range input to CSSO: keep Vite cssMinify disabled so responsive rules survive.');
  return minify(source).css;
}
