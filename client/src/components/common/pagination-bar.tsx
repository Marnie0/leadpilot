import type { PageMeta } from '@leadpilot/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFormat, useT } from '@/lib/i18n';

const PAGE_SIZES = [10, 25, 50, 100];

export function PaginationBar({
  meta,
  onPageChange,
  onPageSizeChange,
  itemLabel,
}: {
  meta: PageMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  /** Plural noun for the record type, already translated. */
  itemLabel: string;
}) {
  const t = useT();
  const format = useFormat();

  const firstItem = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const lastItem = Math.min(meta.page * meta.pageSize, meta.total);

  return (
    <div className="flex flex-col-reverse items-center gap-3 border-t px-4 py-3 sm:flex-row sm:justify-between">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {meta.total === 0
          ? t('pagination.empty', { items: itemLabel })
          : t('pagination.range', {
              from: format.number(firstItem),
              to: format.number(lastItem),
              total: format.number(meta.total),
              items: itemLabel,
            })}
      </p>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 sm:flex">
          <span className="text-sm text-muted-foreground">{t('pagination.rows')}</span>
          <Select
            value={String(meta.pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger size="sm" className="w-[72px]" aria-label={t('pagination.rowsPerPage')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onPageChange(meta.page - 1)}
            disabled={!meta.hasPreviousPage}
            aria-label={t('pagination.previous')}
          >
            {/* "Previous" is the start edge in both directions, so the glyph mirrors. */}
            <ChevronLeft className="icon-directional size-4" />
          </Button>
          <span className="min-w-[84px] text-center text-sm text-muted-foreground tabular-nums">
            {t('pagination.page', {
              page: format.number(meta.page),
              total: format.number(Math.max(meta.totalPages, 1)),
            })}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onPageChange(meta.page + 1)}
            disabled={!meta.hasNextPage}
            aria-label={t('pagination.next')}
          >
            <ChevronRight className="icon-directional size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
