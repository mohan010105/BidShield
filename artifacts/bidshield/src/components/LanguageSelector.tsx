import React, { useState, useRef, useEffect } from 'react';
import { Languages, Check, ChevronDown } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { SUPPORTED_LANGUAGES, Language } from '../i18n/types';

interface LanguageSelectorProps {
  variant?: 'header' | 'settings';
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ variant = 'header' }) => {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentOption = SUPPORTED_LANGUAGES.find((opt) => opt.code === language) || SUPPORTED_LANGUAGES[0];

  if (variant === 'settings') {
    return (
      <div className="space-y-3">
        <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
          {t('settings.languagePreferences')}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SUPPORTED_LANGUAGES.map((opt) => {
            const isSelected = language === opt.code;
            return (
              <button
                key={opt.code}
                onClick={() => opt.enabled && setLanguage(opt.code)}
                disabled={!opt.enabled}
                className={`relative flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : opt.enabled
                    ? 'border-border bg-card hover:border-primary/50 hover:bg-secondary/60'
                    : 'border-border/40 bg-secondary/20 opacity-50 cursor-not-allowed'
                }`}
              >
                <div>
                  <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                    {opt.nativeLabel}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{opt.label}</div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Header Dropdown Variant
  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/70 hover:border-primary/50 bg-secondary/40 hover:bg-secondary text-xs font-medium text-foreground transition-colors"
        aria-label="Select language"
        data-testid="language-selector-button"
      >
        <Languages className="w-3.5 h-3.5 text-primary" />
        <span className="font-semibold">{currentOption.nativeLabel}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-44 rounded-xl border border-border bg-popover/95 backdrop-blur-md shadow-xl py-1 z-50">
          <div className="px-3 py-1.5 border-b border-border/50 text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
            {t('common.selectLanguage')}
          </div>
          {SUPPORTED_LANGUAGES.map((opt) => {
            const isSelected = language === opt.code;
            return (
              <button
                key={opt.code}
                onClick={() => {
                  if (opt.enabled) {
                    setLanguage(opt.code);
                    setOpen(false);
                  }
                }}
                disabled={!opt.enabled}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors text-left ${
                  isSelected
                    ? 'bg-primary/10 text-primary font-semibold'
                    : opt.enabled
                    ? 'text-foreground hover:bg-secondary'
                    : 'text-muted-foreground/50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{opt.nativeLabel}</span>
                  <span className="text-[10px] text-muted-foreground">({opt.label})</span>
                </div>
                {isSelected ? (
                  <Check className="w-3.5 h-3.5 text-primary" />
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
