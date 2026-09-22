/**
 * Brand colour series for the ngx-charts dashboards.
 *
 * Values come from the EdTech for Good design system (workspace
 * docs/design/design-system/tokens/colors.css). The previous earth palette
 * (#005d43, #d86d28, #e4d161, #f9f1e5) predates the brand and its cream
 * fourth series was 1.12:1 against the white card, i.e. invisible.
 */
export const CHART_SERIES = ['#0B5FFF', '#FF640D', '#06AFBC', '#6D5BD0'];

/** Two extra series for the six-series downtime chart. */
export const CHART_SERIES_EXTENDED = [...CHART_SERIES, '#0099D6', '#64748B'];

/** Three-series scheme with a recessive slate for the "none" bucket. */
export const CHART_SERIES_RECESSIVE = ['#0B5FFF', '#FF640D', '#94A3B8'];
