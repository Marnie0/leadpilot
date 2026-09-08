import { Coins } from 'lucide-react';
import { CURRENCIES, type Currency } from '@leadpilot/shared';
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useUpdateProfile } from '@/features/settings/api';
import { useT } from '@/lib/i18n';
import { asCurrency } from '@/lib/money';

/**
 * Display-currency picker as menu rows, alongside language and theme.
 *
 * It belongs with those two rather than buried in settings: all three answer
 * "how do I want to read this", none of them changes the data, and a reader
 * comparing a figure against their own currency wants to do it where they are
 * looking — not two screens away.
 */
export function CurrencyMenuItems() {
  const t = useT();
  const user = useCurrentUser();
  const updateProfile = useUpdateProfile();

  const base = asCurrency(user.organization.defaultCurrency) ?? 'USD';
  // The sentinel keeps "follow the workspace" distinct from "happens to match
  // the workspace today": the first survives the owner changing the currency.
  const value = asCurrency(user.displayCurrency) ?? 'workspace';

  return (
    <>
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        {t('currency.display')}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={value}
        onValueChange={(next) =>
          updateProfile.mutate({
            displayCurrency: next === 'workspace' ? null : (next as Currency),
          })
        }
      >
        <DropdownMenuRadioItem value="workspace">
          <Coins className="size-4" aria-hidden />
          {t('currency.followWorkspaceWith', { code: base })}
        </DropdownMenuRadioItem>
        {CURRENCIES.filter((code) => code !== base).map((code) => (
          <DropdownMenuRadioItem key={code} value={code}>
            <Coins className="size-4" aria-hidden />
            {code} · {t(`currency.${code}`)}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}
