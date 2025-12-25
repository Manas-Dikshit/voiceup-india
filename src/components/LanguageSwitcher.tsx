import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const LANGS = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'od', label: 'ଓଡ଼ିଆ', flag: '🇮🇳' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const change = async (lng: string) => {
    try {
      await i18n.changeLanguage(lng);
      // Optional: persist to user profile
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (user) {
        // Save selected language to profiles table (non-blocking)
        // Using type assertion since we just added the column
        supabase
          .from('profiles')
          .update({ language: lng } as any)
          .eq('id', user.id)
          .then(() => {});
      }
    } catch (err) {
      console.error('Failed to change language', err);
    }
  };

  const currentLang = LANGS.find(l => l.code === i18n.language) || LANGS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{currentLang.flag} {currentLang.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGS.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => change(l.code)}
            className={i18n.language === l.code ? 'bg-accent' : ''}
          >
            <span className="mr-2">{l.flag}</span>
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
