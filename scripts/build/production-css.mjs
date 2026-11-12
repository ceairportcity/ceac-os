import {minify} from 'csso';
import {Features, transform} from 'lightningcss';

// CSSO 5 silently discards modern media-range rules. Fail the build if the
// supported single-pass input contract changes, rather than shipping no phone CSS.
export function minifyProductionCss(source, filename = 'production.css') {
  if (/@media[^{}]*[<>]/i.test(source))
    throw new Error('Unsupported media-range input to CSSO: keep Vite cssMinify disabled so responsive rules survive.');
  // The physical-phone stylesheet correction reads min-/max-width queries in the CSSOM.
  return transform({
    filename,
    code: Buffer.from(minify(source).css),
    minify: true,
    include: Features.MediaRangeSyntax,
  }).code.toString();
}
