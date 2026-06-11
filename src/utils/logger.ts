export function log(module: string, message: string, data?: unknown): void {
  if (__DEV__) {
    const timestamp = new Date().toISOString().slice(11, 23);
    if (data !== undefined) {
      console.log(`[${timestamp}][${module}] ${message}`, data);
    } else {
      console.log(`[${timestamp}][${module}] ${message}`);
    }
  }
}
