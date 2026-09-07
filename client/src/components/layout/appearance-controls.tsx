import { Languages, Monitor, Moon, Sun } from 'lucide-react';
import { LOCALES, type Locale } from '@leadpilot/shared';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme, type Theme } from '@/providers/theme-provider';
import { useI18n } from '@/lib/i18n';

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

/**
 * Language picker as menu rows, for embedding in an existing dropdown.
 *
 * Each language is written in itself. Someone who has landed in the wrong one
 * cannot read a list that names them in the language they do not speak, and
 * that is the one moment this control has to work.
 */
export function LanguageMenuItems() {
  const { t, locale, setLocale } = useI18n();

  return (
    <>
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        {t('menu.language')}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup value={locale} onValueChange={(value) => setLocale(value as Locale)}>
        {LOCALES.map((option) => (
          <DropdownMenuRadioItem key={option} value={option}>
            <Languages className="size-4" aria-hidden /> {t(`language.${option}`)}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}

/** Theme picker as menu rows, for embedding in an existing dropdown. */
export function ThemeMenuItems() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();

  return (
    <>
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        {t('menu.appearance')}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
        <DropdownMenuRadioItem value="light">
          <Sun className="size-4" aria-hidden /> {t('menu.themeLight')}
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dark">
          <Moon className="size-4" aria-hidden /> {t('menu.themeDark')}
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="system">
          <Monitor className="size-4" aria-hidden /> {t('menu.themeSystem')}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </>
  );
}

/**
 * Standalone language and theme controls for the signed-out screens.
 *
 * Both settings live in the account menu once you are inside, but the login and
 * signup pages have no account menu — and those are precisely the screens where
 * someone who cannot read the interface needs to be able to change it. A
 * visitor arriving with an Arabic browser already lands in Arabic; this is the
 * way back for everyone else.
 */
export function AppearanceControls({ className }: { className?: string }) {
  const { t, locale, setLocale } = useI18n();
  const { theme } = useTheme();
  const ThemeIcon = THEME_ICONS[theme];

  // Two languages means a toggle says everything a menu would, in one tap.
  const other: Locale = locale === 'ar' ? 'en' : 'ar';

  return (
    <div className={className}>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground hover:text-foreground"
        onClick={() => setLocale(other)}
        aria-label={t('language.switch')}
      >
        <Languages className="size-4" aria-hidden />
        {t(`language.${other}`)}
      </Button>

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                aria-label={t('menu.appearance')}
              >
                <ThemeIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{t('menu.appearance')}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-44">
          <ThemeMenuItems />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
