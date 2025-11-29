import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'od', label: 'ଓଡ଼ିଆ' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const change = async (lng: string) => {
    try {
      await i18n.changeLanguage(lng);
      // Optional: persist in localStorage handled by i18next-browser-languagedetector's caches config
      // Optional: persist to user profile
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (user) {
        // Save selected language to profiles table (non-blocking)
        supabase.from('profiles').update({ language: lng }).eq('id', user.id).then(() => {});
      }
    } catch (err) {
      console.error('Failed to change language', err);
    }
  };

  return (
    <div className="flex items-center">
      {LANGS.map((l) => (
        <Button variant="ghost" key={l.code} onClick={() => change(l.code)} className="text-sm">
          {l.label}
        </Button>
      ))}
    </div>
  );
}
