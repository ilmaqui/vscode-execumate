export function safeReplacer() {
  const seen = new WeakSet();
  return (key: string, value: any) => {
    // Filter out known problematic keys
    if (key === "provider" || key === "terminal" || key === "command") {
      return undefined;
    }
    // If the value is an object and has a disallowed property, omit it.
    if (value && typeof value === "object" && "extensionRuntime" in value) {
      return undefined;
    }
    // Handle circular references
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return undefined;
      }
      seen.add(value);
    }
    return value;
  };
}
