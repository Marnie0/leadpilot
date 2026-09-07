import { useState } from 'react';
import type { LeadSortField } from '@leadpilot/shared';
import { Plus, SearchX, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PaginationBar } from '@/components/common/pagination-bar';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useLeadFilters } from '@/features/leads/hooks/use-lead-filters';
import { useLeadStats, useLeads, useStages, useTeamMembers } from '@/features/leads/api';
import { LeadFilterBar } from '@/features/leads/components/lead-filter-bar';
import { LeadStats } from '@/features/leads/components/lead-stats';
import { LeadsTable } from '@/features/leads/components/leads-table';
import { LeadCard, LeadCardSkeleton } from '@/features/leads/components/lead-card';
import { LeadFormDialog } from '@/features/leads/components/lead-form-dialog';

export function LeadsPage() {
  const user = useCurrentUser();
  const { filters, setFilters, resetFilters, hasActiveFilters } = useLeadFilters();
  const [isCreateOpen, setCreateOpen] = useState(false);

  const leadsQuery = useLeads(filters);
  const statsQuery = useLeadStats(filters);
  const stagesQuery = useStages();
  const teamQuery = useTeamMembers();

  const leads = leadsQuery.data?.data ?? [];
  const meta = leadsQuery.data?.meta;

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
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Leads"
        description={`Every enquiry across ${user.organization.name}, in one place.`}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> New lead
          </Button>
        }
      />

      <LeadStats
        stats={statsQuery.data}
        currency={user.organization.defaultCurrency}
        isLoading={statsQuery.isLoading}
      />

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
            title="Could not load leads"
          />
        </Card>
      ) : showEmptyState ? (
        <Card>
          {hasActiveFilters ? (
            <EmptyState
              icon={SearchX}
              title="No leads match these filters"
              description="Try widening your search, or clear the filters to see the whole pipeline."
              action={
                <Button variant="outline" onClick={resetFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No leads yet"
              description="Add your first enquiry and it will show up here with its full activity history."
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="size-4" /> New lead
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
              : leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)}
            {meta && (
              <Card className="p-0">
                <PaginationBar
                  meta={meta}
                  onPageChange={(page) => setFilters({ page })}
                  onPageSizeChange={(pageSize) => setFilters({ pageSize, page: 1 })}
                  itemLabel="leads"
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
            />
            {meta && (
              <PaginationBar
                meta={meta}
                onPageChange={(page) => setFilters({ page })}
                onPageSizeChange={(pageSize) => setFilters({ pageSize, page: 1 })}
                itemLabel="leads"
              />
            )}
          </Card>
        </>
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
