/**
 * Native browser virtualization hint for large, already-fetched collections.
 * `content-visibility:auto` keeps all rows accessible while allowing Chromium
 * to skip layout/paint work for off-screen rows; pagination remains primary.
 */
export default function VirtualizedList({ items, rowHeight = 48, renderRow, overscan = 8 }) {
  return items.map((item, index) => (
    renderRow(item, index, { contentVisibility: 'auto', containIntrinsicSize: `${rowHeight}px` })
  ));
}
