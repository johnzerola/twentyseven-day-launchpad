import { useState, useCallback } from 'react';

export const PAGE_SIZE = 20;

interface UsePaginationResult<T> {
  items: T[];
  page: number;
  totalCount: number;
  hasMore: boolean;
  hasPrev: boolean;
  loading: boolean;
  setItems: (items: T[]) => void;
  setTotalCount: (count: number) => void;
  setLoading: (loading: boolean) => void;
  nextPage: () => void;
  prevPage: () => void;
  resetPage: () => void;
  rangeFrom: number;
  rangeTo: number;
}

export function usePagination<T>(pageSize = PAGE_SIZE): UsePaginationResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const hasMore = (page + 1) * pageSize < totalCount;
  const hasPrev = page > 0;

  const nextPage = useCallback(() => {
    if (hasMore) setPage(p => p + 1);
  }, [hasMore]);

  const prevPage = useCallback(() => {
    if (hasPrev) setPage(p => p - 1);
  }, [hasPrev]);

  const resetPage = useCallback(() => setPage(0), []);

  return {
    items,
    page,
    totalCount,
    hasMore,
    hasPrev,
    loading,
    setItems,
    setTotalCount,
    setLoading,
    nextPage,
    prevPage,
    resetPage,
    rangeFrom: page * pageSize,
    rangeTo: (page + 1) * pageSize - 1,
  };
}
