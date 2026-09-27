import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { Language, SUPPORTED_LANGUAGES } from './types';
import { en, Translations } from './translations/en';
import { ta } from './translations/ta';
import { hi } from './translations/hi';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: string;
  formatCurrency: (amount?: number | null) => string;
  formatDate: (date?: string | Date | null) => string;
  formatNumber: (num?: number | null) => string;
  translateStatus: (val?: string | null) => string;
}

const STORAGE_KEY = 'bidshield_language';

function getEffectiveStorageKey(): string {
  try {
    const currentUserId = localStorage.getItem('bidshield_user_id') || localStorage.getItem('bidshield_current_user');
    if (currentUserId) {
      return `${STORAGE_KEY}_${currentUserId}`;
    }
  } catch (e) {}
  return STORAGE_KEY;
}

function getInitialLanguage(): Language {
  try {
    const userKey = getEffectiveStorageKey();
    const saved = localStorage.getItem(userKey) || localStorage.getItem(STORAGE_KEY);
    if (saved === 'ta' || saved === 'en' || saved === 'hi') {
      return saved as Language;
    }
  } catch (e) {
    // localStorage unavailable or restricted
  }
  return 'en';
}

const dictionaries: Record<string, Translations> = {
  en,
  ta,
  hi,
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
    try {
      const userKey = getEffectiveStorageKey();
      localStorage.setItem(userKey, newLang);
      localStorage.setItem(STORAGE_KEY, newLang);
      document.documentElement.lang = newLang;
    } catch (e) {
      // localStorage unavailable
    }
  };

  useEffect(() => {
    const handleStorageChange = () => {
      const lang = getInitialLanguage();
      setLanguageState(lang);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch (e) {}
  }, [language]);

  const locale = useMemo(() => {
    switch (language) {
      case 'ta':
        return 'ta-IN';
      case 'hi':
        return 'hi-IN';
      case 'en':
      default:
        return 'en-IN';
    }
  }, [language]);

  const t = useMemo(() => {
    return (path: string, params?: Record<string, string | number>): string => {
      const keys = path.split('.');
      const currentDict = dictionaries[language] || en;
      
      let val: any = currentDict;
      for (const k of keys) {
        if (val && typeof val === 'object' && k in val) {
          val = val[k];
        } else {
          val = undefined;
          break;
        }
      }

      // Fallback to English if not found
      if (val === undefined) {
        let fallbackVal: any = en;
        for (const k of keys) {
          if (fallbackVal && typeof fallbackVal === 'object' && k in fallbackVal) {
            fallbackVal = fallbackVal[k];
          } else {
            fallbackVal = undefined;
            break;
          }
        }
        val = fallbackVal !== undefined ? fallbackVal : path;
      }

      if (typeof val === 'string' && params) {
        return val.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
      }

      return typeof val === 'string' ? val : path;
    };
  }, [language]);

  const formatCurrency = (amount?: number | null): string => {
    if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—';
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `₹${amount.toLocaleString()}`;
    }
  };

  const formatDate = (date?: string | Date | null): string => {
    if (!date) return '—';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(d.getTime())) return String(date);
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(d);
    } catch {
      return String(date);
    }
  };

  const formatNumber = (num?: number | null): string => {
    if (num === null || num === undefined || !Number.isFinite(num)) return '0';
    try {
      return new Intl.NumberFormat(locale).format(num);
    } catch {
      return String(num);
    }
  };

  const translateStatus = (val?: string | null): string => {
    if (!val) return '';
    const s = String(val).trim();
    const upper = s.toUpperCase().replace(/[\s-]+/g, '_');
    
    if (upper === 'HIGH' || upper === 'HIGH_SCREENING_SIGNAL' || upper === 'HIGH_INDICATOR') {
      return t('status.high');
    }
    if (upper === 'ELEVATED' || upper === 'ELEVATED_SCREENING_SIGNAL' || upper === 'ELEVATED_INDICATOR') {
      return t('status.elevated');
    }
    if (upper === 'MODERATE' || upper === 'MODERATE_SCREENING_SIGNAL' || upper === 'MODERATE_INDICATOR') {
      return t('status.moderate');
    }
    if (upper === 'LOW' || upper === 'LOW_SCREENING_SIGNAL' || upper === 'LOW_INDICATOR') {
      return t('status.low');
    }
    if (upper === 'INSUFFICIENT_DATA' || upper === 'INSUFFICIENT') {
      return t('status.insufficientData');
    }
    if (upper === 'OPEN') return t('status.open');
    if (upper === 'IN_REVIEW' || upper === 'INREVIEW') return t('status.inReview');
    if (upper === 'WATCHLIST') return t('status.watchlist');
    if (upper === 'CLOSED') return t('status.closed');
    if (upper === 'DRAFT') return t('status.draft');
    if (upper === 'REVIEWED') return t('status.reviewed');
    if (upper === 'APPROVED') return t('status.approved');
    if (upper === 'REJECTED') return t('status.rejected');
    if (upper === 'ACTIVE') return t('status.active');
    if (upper === 'CONNECTED') return t('status.connected');
    if (upper === 'AVAILABLE') return t('status.available');
    if (upper === 'ALL') return t('status.all');

    return s;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        locale,
        formatCurrency,
        formatDate,
        formatNumber,
        translateStatus,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export function useTranslation() {
  return useLanguage();
}
