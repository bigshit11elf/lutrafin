export function safeRedirectPath(
  value: string | null | undefined,
  fallback = '/'
) {
  if (
    !value?.startsWith('/') ||
    value.startsWith('//') ||
    value.startsWith('/\\') ||
    value.includes('\\')
  )
    return fallback;
  return value;
}
