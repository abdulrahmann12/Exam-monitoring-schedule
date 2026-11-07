import type { BackendPaginatedResponse, NormalizedPaginatedResponse } from "../types";

export function normalizePaginatedResponse<T>(
  payload: BackendPaginatedResponse<T>,
): NormalizedPaginatedResponse<T> {
  return {
    items: Array.isArray(payload.content) ? payload.content : [],
    page:
      typeof payload.currentPage === "number"
        ? payload.currentPage
        : typeof payload.page === "number"
          ? payload.page
          : 0,
    size:
      typeof payload.size === "number"
        ? payload.size
        : Array.isArray(payload.content)
          ? payload.content.length
          : 0,
    totalItems: typeof payload.totalElements === "number" ? payload.totalElements : 0,
    totalPages: typeof payload.totalPages === "number" ? payload.totalPages : 0,
  };
}

/** Largest page the server accepts (PageRequestFactory.MAX_PAGE_SIZE). */
export const MAX_BACKEND_PAGE_SIZE = 1000;

export type PaginatedQueryParams = {
  page?: number;
  size?: number;
};

export function clampPageSize(size?: number): number {
  if (typeof size !== "number" || !Number.isFinite(size)) {
    return MAX_BACKEND_PAGE_SIZE;
  }

  return Math.min(Math.max(Math.trunc(size), 1), MAX_BACKEND_PAGE_SIZE);
}

/** Loads every page (the server allows up to 1000 rows per page), so lists are never cut off silently. */
export async function fetchAllPaginatedItems<TItem, TParams extends PaginatedQueryParams>(
  params: TParams,
  fetchPage: (params: TParams) => Promise<NormalizedPaginatedResponse<TItem>>,
): Promise<NormalizedPaginatedResponse<TItem>> {
  const baseParams = {
    ...params,
    page: 0,
    size: clampPageSize(params.size),
  } as TParams;

  const firstPage = await fetchPage(baseParams);
  const totalPages = Math.max(
    firstPage.totalPages,
    firstPage.totalItems > 0 ? Math.ceil(firstPage.totalItems / baseParams.size) : 0,
  );

  if (totalPages <= 1) {
    return {
      ...firstPage,
      page: 0,
      size: baseParams.size,
    };
  }

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      fetchPage({
        ...baseParams,
        page: index + 1,
      } as TParams)),
  );

  const items = [
    ...firstPage.items,
    ...remainingPages.flatMap((page) => page.items),
  ];

  return {
    ...firstPage,
    items,
    page: 0,
    size: baseParams.size,
    totalItems: Math.max(firstPage.totalItems, items.length),
    totalPages,
  };
}
