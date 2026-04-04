let extensionVersion = '';

export function setExtensionVersion(version: string): void {
  extensionVersion = typeof version === 'string' ? version : '';
}

export function getExtensionVersion(): string {
  return extensionVersion;
}
