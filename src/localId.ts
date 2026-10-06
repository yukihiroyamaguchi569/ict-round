/** ID for a record kept on this device (a photo, an imported checklist). Not meant to be unique across devices. */
export function newLocalId(): string {
  // eslint-disable-next-line sonarjs/pseudo-random -- local ID only, not security-sensitive
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
