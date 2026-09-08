import { useEffect, useState } from 'react';
import { Loader2, MoreHorizontal, Plus, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS, type Permission, type RoleDto } from '@leadpilot/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { useCreateRole, useDeleteRole, useRoles, useUpdateRole } from '@/features/team/api';
import { useI18n, useT } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import { roleLabel } from '@/lib/permissions';

/**
 * The workspace's roles, and what each one may do. Owner only.
 *
 * ## Why the owner alone
 *
 * A role is a permission set, so anyone who can edit roles can grant themselves
 * anything — "admin can edit roles" is the same sentence as "admin is owner".
 * Three powers stay outside the matrix entirely for that reason: managing
 * roles, transferring ownership, and deleting the workspace.
 *
 * ## The owner role is shown but not editable
 *
 * It appears in the list so the picture is complete, and it can be renamed
 * (a workspace that calls it "Founder" should be able to say so), but its
 * permissions are fixed at everything. A workspace whose owner had switched off
 * their own ability to manage the team would be one nobody could administer.
 *
 * ## Deleting a role names its destination
 *
 * Every account holds a role, so a role with people in it cannot simply vanish.
 * The dialog asks where they go rather than picking a default and silently
 * changing what somebody can do.
 */
export function RolesCard() {
  const t = useT();
  const { locale } = useI18n();
  const describeError = useApiErrorMessage();

  const rolesQuery = useRoles();
  const roles = rolesQuery.data ?? [];

  const [editing, setEditing] = useState<RoleDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<RoleDto | null>(null);

  return (
    <>
      <Card className="gap-0 p-0">
        {/* CardHeader is a grid, so the row is built inside it rather than by
            fighting the layout it already has. */}
        <CardHeader className="px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle>{t('roles.title')}</CardTitle>
              <CardDescription>{t('roles.body')}</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditing('new')}>
              <Plus className="size-4" /> {t('roles.new')}
            </Button>
          </div>
        </CardHeader>

        {rolesQuery.isError ? (
          <ErrorState error={rolesQuery.error} onRetry={() => void rolesQuery.refetch()} />
        ) : rolesQuery.isLoading ? (
          <CardContent className="space-y-3 pb-6">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </CardContent>
        ) : roles.length === 0 ? (
          <EmptyState icon={ShieldCheck} title={t('roles.empty')} />
        ) : (
          <ul className="divide-y border-t" aria-label={t('roles.title')}>
            {roles.map((role) => (
              <li key={role.id} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                    <span dir="auto">{roleLabel(role, locale)}</span>
                    {role.isSystem && <Badge variant="outline">{t('roles.builtIn')}</Badge>}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground" dir="auto">
                    {role.key === 'OWNER'
                      ? t('roles.everything')
                      : role.permissions.length === 0
                        ? t('roles.nonePermissions')
                        : role.permissions
                            .map((permission) => t(`permission.${permission}`))
                            .join(t('common.listSeparator'))}
                  </p>
                </div>

                <p className="text-xs text-muted-foreground sm:min-w-[110px] sm:text-end">
                  {t('roles.memberCount', { count: role.memberCount })}
                </p>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('roles.manage', { name: roleLabel(role, locale) })}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(role)}>
                      {role.key === 'OWNER' ? t('roles.rename') : t('roles.edit')}
                    </DropdownMenuItem>
                    {!role.isSystem && (
                      <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(role)}>
                        {t('roles.delete')}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <RoleDialog
        target={editing}
        onClose={() => setEditing(null)}
        onFailed={(error) =>
          toast.error(t('roles.couldNotSave'), { description: describeError(error) })
        }
      />

      <DeleteRoleDialog
        role={deleting}
        roles={roles}
        onClose={() => setDeleting(null)}
        onFailed={(error) =>
          toast.error(t('roles.couldNotDelete'), { description: describeError(error) })
        }
      />
    </>
  );
}

/** Create and edit share a dialog: the fields are identical, only the verb differs. */
function RoleDialog({
  target,
  onClose,
  onFailed,
}: {
  target: RoleDto | 'new' | null;
  onClose: () => void;
  onFailed: (error: unknown) => void;
}) {
  const t = useT();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();

  const existing = target === 'new' || target === null ? null : target;
  const isOwnerRole = existing?.key === 'OWNER';

  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [permissions, setPermissions] = useState<Permission[]>([]);

  // Reset when the dialog opens, so a second edit never inherits the first.
  useEffect(() => {
    if (target === null) return;
    setName(existing?.name ?? '');
    setNameAr(existing?.nameAr ?? '');
    setPermissions(existing ? [...existing.permissions] : []);
  }, [target, existing]);

  const toggle = (permission: Permission, on: boolean) =>
    setPermissions((current) =>
      on ? [...current, permission] : current.filter((value) => value !== permission),
    );

  const isPending = createRole.isPending || updateRole.isPending;
  const trimmed = name.trim();

  const submit = () => {
    const done = { onSuccess: onClose, onError: onFailed };
    if (!existing) {
      createRole.mutate({ name: trimmed, nameAr: nameAr.trim(), permissions }, done);
      return;
    }
    updateRole.mutate(
      {
        id: existing.id,
        name: trimmed,
        nameAr: nameAr.trim(),
        // The owner role's permissions are fixed; sending them would be rejected.
        ...(isOwnerRole ? {} : { permissions }),
      },
      done,
    );
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? t('roles.editTitle') : t('roles.newTitle')}</DialogTitle>
          <DialogDescription>
            {isOwnerRole ? t('roles.ownerFixed') : t('roles.dialogBody')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role-name">{t('roles.fieldName')}</Label>
              <Input
                id="role-name"
                value={name}
                dir="auto"
                maxLength={40}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-name-ar">{t('roles.fieldNameAr')}</Label>
              <Input
                id="role-name-ar"
                value={nameAr}
                dir="rtl"
                lang="ar"
                maxLength={40}
                placeholder={trimmed}
                onChange={(event) => setNameAr(event.target.value)}
              />
            </div>
          </div>

          {!isOwnerRole && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">{t('roles.permissionsLegend')}</legend>
              {PERMISSIONS.map((permission) => (
                <label
                  key={permission}
                  htmlFor={`permission-${permission}`}
                  className="flex cursor-pointer items-start gap-3"
                >
                  <Checkbox
                    id={`permission-${permission}`}
                    className="mt-0.5"
                    checked={permissions.includes(permission)}
                    onCheckedChange={(checked) => toggle(permission, checked === true)}
                  />
                  <span className="space-y-0.5">
                    <span className="block text-sm leading-none font-medium text-foreground">
                      {t(`permission.${permission}`)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t(`permissionHint.${permission}`)}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={isPending || trimmed.length < 2} onClick={submit}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {existing ? t('roles.save') : t('roles.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Deleting a role. Asks where its holders go before it will proceed. */
function DeleteRoleDialog({
  role,
  roles,
  onClose,
  onFailed,
}: {
  role: RoleDto | null;
  roles: RoleDto[];
  onClose: () => void;
  onFailed: (error: unknown) => void;
}) {
  const t = useT();
  const { locale } = useI18n();
  const deleteRole = useDeleteRole();
  const [destination, setDestination] = useState('');

  useEffect(() => {
    if (role) setDestination('');
  }, [role]);

  const alternatives = roles.filter(
    (candidate) => candidate.id !== role?.id && candidate.key !== 'OWNER',
  );
  /*
   * Settled invitations still point at the role and the database will not let
   * it go while they do, so the picker follows `referenceCount` rather than the
   * member count — the copy below is what distinguishes "three people hold
   * this" from "only an old invitation refers to it".
   */
  const needsDestination = (role?.referenceCount ?? 0) > 0;
  const holders = role?.memberCount ?? 0;

  return (
    <Dialog open={role !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle dir="auto">
            {t('roles.deleteTitle', { name: role ? roleLabel(role, locale) : '' })}
          </DialogTitle>
          <DialogDescription>
            {!needsDestination
              ? t('roles.deleteBody')
              : holders > 0
                ? t('roles.deleteBodyInUse', { count: holders })
                : t('roles.deleteBodyReferenced')}
          </DialogDescription>
        </DialogHeader>

        {needsDestination && (
          <div className="space-y-2">
            <Label htmlFor="role-destination">{t('roles.moveTo')}</Label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger id="role-destination" className="w-full">
                <SelectValue placeholder={t('roles.moveToPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {alternatives.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {roleLabel(candidate, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            disabled={
              deleteRole.isPending || (needsDestination && destination.length === 0) || !role
            }
            onClick={() => {
              if (!role) return;
              deleteRole.mutate(
                { id: role.id, ...(needsDestination ? { reassignToRoleId: destination } : {}) },
                { onSuccess: onClose, onError: onFailed },
              );
            }}
          >
            {deleteRole.isPending && <Loader2 className="size-4 animate-spin" />}
            {t('roles.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
