export type MapCoordinate = { id: string; lat: number; lng: number };

export function hasValidMapCoordinates(point: MapCoordinate): boolean {
  return Boolean(point.id.trim()) &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180;
}

export function uniqueById<T>(items: readonly T[], getId: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = getId(item);
    if (!id.trim() || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function onlyConnectEnabled<T extends { vendor_id: string }>(
  vendors: readonly T[],
  enabledVendorIds: ReadonlySet<string>,
): T[] {
  return vendors.filter((vendor) => enabledVendorIds.has(vendor.vendor_id));
}

export function uniqueValidMapPins<T extends MapCoordinate>(pins: readonly T[]): T[] {
  return uniqueById(pins.filter(hasValidMapCoordinates), (pin) => pin.id);
}

export function mergeMarketplaceAndConnectPins<T extends MapCoordinate>(
  marketplacePins: readonly T[],
  connectOnlyPins: readonly T[],
): T[] {
  // Marketplace pins take precedence for shared IDs; Connect supplies pins only
  // for vendors not already represented by the product marketplace.
  return uniqueValidMapPins([...marketplacePins, ...connectOnlyPins]);
}
