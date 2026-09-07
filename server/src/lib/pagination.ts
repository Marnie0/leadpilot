import type { PageMeta, Paginated } from '@leadpilot/shared';

export interface PaginationArgs {
  page: number;
  pageSize: number;
}

/** Translates a 1-based page into Prisma's `skip`/`take`. */
export function toPrismaPagination({ page, pageSize }: PaginationArgs) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function buildPageMeta(args: PaginationArgs, total: number): PageMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / args.pageSize);
  return {
    page: args.page,
    pageSize: args.pageSize,
    total,
    totalPages,
    hasNextPage: args.page < totalPages,
    hasPreviousPage: args.page > 1,
  };
}

export function paginate<T>(data: T[], args: PaginationArgs, total: number): Paginated<T> {
  return { data, meta: buildPageMeta(args, total) };
}
