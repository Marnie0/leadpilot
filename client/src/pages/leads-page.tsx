import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TRASH_RETENTION_DAYS, type LeadSortField, type LeadView } from '@leadpilot/shared';
import { ArrowLeft, Plus, SearchX, Trash2, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';

/** Each view names itself, so the screen you land on says what it is. */
const VIEW_TITLES: Record<LeadView, StaticKey> = {
  active: 'leads.title',
  archived: 'leads.archivedTitle',
  trash: 'nav.trash',
};
import { ConversionNote } from '@/components/common/conversion-note';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PaginationBar } from '@/components/common/pagination-bar';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useT, type StaticKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useLeadFilters } from '@/features/leads/hooks/use-lead-filters';
import { useLeadStats, useLeads, useStages, useTeamMembers } from '@/features/leads/api';
import { LeadFilterBar } from '@/features/leads/components/lead-filter-bar';
import { LeadStats } from '@/features/leads/components/lead-stats';
import { LeadsTable } from '@/features/leads/components/leads-table';
import { LeadCard, LeadCardSkeleton } from '@/features/leads/components/lead-card';
import { LeadFormDialog } from '@/features/leads/components/lead-form-dialog';
import { BulkActionBar } from '@/features/leads/components/bulk-action-bar';
import { useLeadSelection } from '@/features/leads/hooks/use-lead-selection';

export function LeadsPage() {
  const t = useT();
  const user = useCurrentUser();
  const { filters, setFilters, resetFilters, hasActiveFilters } = useLeadFilters();
  const [isCreateOpen, setCreateOpen] = useState(false);

  const leadsQuery = useLeads(filters);
  const statsQuery = useLeadStats(filters);
  const stagesQuery = useStages();
  const teamQuery = useTeamMembers();

  const leads = leadsQuery.data?.data ?? [];
  const meta = leadsQuery.data?.meta;

  // Selection is scoped to what is on screen, so it resets whenever the query
  // behind the table does — see `useLeadSelection` for why that is deliberate.
  const selection = useLeadSelection(leads, filters);
  const canArchive = user.role === 'OWNER' || user.role === 'ADMIN';

  /** Clicking the active sort column flips direction; a new column starts descending. */
  const handleSort = (field: LeadSortField) => {
    setFilters(
      filters.sortBy === field
        ? { sortDir: filters.sortDir === 'asc' ? 'desc' : 'asc' }
        : { sortBy: field, sortDir: 'desc' },
    );
  };

  const showEmptyState = !leadsQuery.isLoading && leads.length === 0;

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8',
        // The action bar floats over the page, so without this the last row
        // sits permanently underneath it and cannot be scrolled into view.
        selection.isActive && 'pb-28',
      )}
    >
      {/*
        The header follows the view. Arriving from the sidebar's Trash and
        landing on a page headed "Leads" reads as the wrong screen, and "New
        lead" is not an action the trash has any business offering. The stats
        strip goes with it: totals and pipeline value describe a working set,
        not a recycling bin.
      */}
      <PageHeader
        title={t(VIEW_TITLES[filters.view])}
        description={
          filters.view === 'trash'
            ? t('leads.trashDescription', { count: TRASH_RETENTION_DAYS })
            : filters.view === 'archived'
              ? t('leads.archivedDescription', { organization: user.organization.name })
              : t('leads.description', { organization: user.organization.name })
        }
        actions={
          filters.view === 'active' ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> {t('leads.newLead')}
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <Link to="/leads">
                <ArrowLeft className="icon-directional size-4" /> {t('leads.backToActive')}
              </Link>
            </Button>
          )
        }
      />

      {filters.view === 'active' && (
        <>
          <LeadStats
            stats={statsQuery.data}
            currency={user.organization.defaultCurrency}
            isLoading={statsQuery.isLoading}
          />

          <ConversionNote className="-mt-3" />
        </>
      )}

      <LeadFilterBar
        filters={filters}
        onChange={setFilters}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
        stages={stagesQuery.data ?? []}
        members={teamQuery.data ?? []}
      />

      {leadsQuery.isError ? (
        <Card>
          <ErrorState
            error={leadsQuery.error}
            onRetry={() => void leadsQuery.refetch()}
            title={t('leads.couldNotLoad')}
          />
        </Card>
      ) : showEmptyState ? (
        <Card>
          {hasActiveFilters ? (
            <EmptyState
              icon={SearchX}
              title={t('leads.noMatchTitle')}
              description={t('leads.noMatchBody')}
              action={
                <Button variant="outline" onClick={resetFilters}>
                  {t('common.clearFilters')}
                </Button>
              }
            />
          ) : filters.view === 'trash' ? (
            <EmptyState
              icon={Trash2}
              title={t('leads.trashEmptyTitle')}
              description={t('leads.trashEmptyBody', { count: TRASH_RETENTION_DAYS })}
            />
          ) : filters.view === 'archived' ? (
            <EmptyState
              icon={Users}
              title={t('leads.archivedEmptyTitle')}
              description={t('leads.archivedEmptyBody')}
            />
          ) : (
            <EmptyState
              icon={Users}
              title={t('leads.emptyTitle')}
              description={t('leads.emptyBody')}
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="size-4" /> {t('leads.newLead')}
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <>
          {/* Cards below lg, the full table above it. */}
          <div className="space-y-3 lg:hidden">
            {leadsQuery.isLoading && leads.length === 0
              ? Array.from({ length: 5 }, (_, index) => <LeadCardSkeleton key={index} />)
              : leads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    selected={selection.isSelected(lead.id)}
                    selectionActive={selection.isActive}
                    {...(lead.canEdit && { onToggleSelected: () => selection.toggle(lead.id) })}
                  />
                ))}
            {meta && (
              <Card className="p-0">
                <PaginationBar
                  meta={meta}
                  onPageChange={(page) => setFilters({ page })}
                  onPageSizeChange={(pageSize) => setFilters({ pageSize, page: 1 })}
                  itemLabel={t('leads.itemLabel')}
                />
              </Card>
            )}
          </div>

          <Card className="hidden gap-0 overflow-hidden p-0 lg:block">
            <LeadsTable
              leads={leads}
              isLoading={leadsQuery.isLoading}
              sortBy={filters.sortBy}
              sortDir={filters.sortDir}
              onSort={handleSort}
              selection={selection}
            />
            {meta && (
              <PaginationBar
                meta={meta}
                onPageChange={(page) => setFilters({ page })}
                onPageSizeChange={(pageSize) => setFilters({ pageSize, page: 1 })}
                itemLabel={t('leads.itemLabel')}
              />
            )}
          </Card>
        </>
      )}

      {selection.count > 0 && (
        <BulkActionBar
          ids={selection.ids}
          stages={stagesQuery.data ?? []}
          members={teamQuery.data ?? []}
          canArchive={canArchive}
          view={filters.view}
          onDone={selection.retain}
          onClear={selection.clear}
        />
      )}

      <LeadFormDialog
        open={isCreateOpen}
        onOpenChange={setCreateOpen}
        stages={stagesQuery.data ?? []}
        members={teamQuery.data ?? []}
        defaultCurrency={user.organization.defaultCurrency}
      />
    </div>
  );
}
