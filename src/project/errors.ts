/** SOURCE OF TRUTH: project transport diagnostics.
 * WHAT: preserve actionable codes without exposing host error details.
 * WHY: policy and effect failures share the core result contract.
 * WHERE: commands, Vite inspection and scoped services.
 */
export function fault(code: string, message: string, target?: string) {
  return Object.assign(new Error(message), { code, target });
}
