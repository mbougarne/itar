// The probe deliberately stalls JS so an operator can observe native feedback.
export function blockJavaScript(durationMs: number): number {
  const start = Date.now();

  while (Date.now() - start < durationMs) {
    // Busy wait on the JS thread for the requested interval.
  }

  return Date.now() - start;
}
