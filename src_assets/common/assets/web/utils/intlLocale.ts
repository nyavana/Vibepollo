export function toIntlLocale(locale?: string): string | undefined {
  const value = String(locale ?? '').trim();
  if (!value) return undefined;
  if (value === 'zh') return 'zh-CN';
  if (value === 'zh_TW') return 'zh-TW';
  return value.replaceAll('_', '-');
}
