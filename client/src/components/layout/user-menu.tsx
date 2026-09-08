import { useNavigate } from 'react-router-dom';
import { ChevronsUpDown, LogOut, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/auth-context';
import { initials } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CurrencyMenuItems } from '@/features/settings/components/currency-menu-items';
import { LanguageMenuItems, ThemeMenuItems } from './appearance-controls';

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useAuth();
  const t = useT();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    toast.success(t('menu.signedOut'));
    navigate('/login', { replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-start gap-3 px-2 py-2 hover:bg-sidebar-accent/60"
          aria-label={compact ? t('menu.accountMenu') : undefined}
        >
          <Avatar className="size-8">
            <AvatarFallback
              style={{ backgroundColor: user.avatarColor }}
              className="text-xs font-semibold text-white"
            >
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          {!compact && (
            <>
              <span className="flex min-w-0 flex-1 flex-col items-start text-start">
                <span className="w-full truncate text-sm font-medium text-foreground">
                  {user.name}
                </span>
                <span className="w-full truncate text-xs text-muted-foreground">
                  {t(`role.${user.role}`)}
                </span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side="top" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium text-foreground">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => navigate('/settings')}>
          <Settings className="size-4" aria-hidden /> {t('nav.settings')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        <LanguageMenuItems />
        <DropdownMenuSeparator />
        <CurrencyMenuItems />
        <DropdownMenuSeparator />
        <ThemeMenuItems />

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout} variant="destructive">
          <LogOut className="icon-directional size-4" aria-hidden /> {t('menu.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
