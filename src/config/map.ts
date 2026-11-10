/**
 * The street map: which map service draws the background, and the credit that must be shown with it.
 *
 * The map library is MapLibre GL (open source, loaded only on pages that show a map). The background comes
 * from OpenFreeMap: free, no account or key, commercial use allowed, built from OpenStreetMap data.
 * To move to another provider later, change MAP_STYLE_URL (and the credit to match that provider's terms),
 * and add the new host to connect-src in public/_headers and admin-app/public/_headers.
 */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

/** Required credit, shown under every map as well as in the map's own corner */
export const MAP_CREDIT = [
  { label: 'OpenFreeMap', href: 'https://openfreemap.org' },
  { label: '© OpenMapTiles', href: 'https://www.openmaptiles.org/' },
  { label: 'Data from OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
];

/** Line colours on maps: the closed stretch in red, the diversion in blue (dashed) */
export const CLOSED_LINE_COLOUR = '#c81e1e';
export const DIVERSION_LINE_COLOUR = '#004a94';
