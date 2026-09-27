export type Language = 'en' | 'ta' | 'hi';

export interface LanguageOption {
  code: Language;
  label: string;
  nativeLabel: string;
  enabled: boolean;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', enabled: true },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', enabled: true },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', enabled: true },
];
