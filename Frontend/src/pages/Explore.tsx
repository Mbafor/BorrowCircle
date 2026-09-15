import { useEffect, useRef, useState } from 'react';
import { browseItems } from '../api/items';
import { ApiError } from '../api/client';
import type { BrowseItem, BorrowType } from '../types/item';
import type { Pagination } from '../types/pagination';
import SearchBar from '../components/SearchBar';
import FilterPanel from '../components/FilterPanel';
import ItemCard from '../components/ItemCard';
import EmptyState from '../components/EmptyState';

type SortOption = 'newest' | 'price_asc' | 'price_desc';

const PAGE_SIZE = 12;

const SKELETONS = Array.from({ length: 6 }, (_, i) => i);

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-tile border border-ink/10 bg-white">
      <div className="h-[146px] animate-pulse bg-ink/[0.06]" />
      <div className="grid gap-2.5 p-4">
        <div className="h-3.5 w-3/4 animate-pulse rounded-full bg-ink/[0.06]" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-ink/[0.05]" />
        <div className="h-3 w-1/3 animate-pulse rounded-full bg-ink/[0.05]" />
      </div>
    </div>
  );
}

export default function Explore() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [borrowType, setBorrowType] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<BrowseItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const requestIdRef = useRef(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, category, location, borrowType, sort]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    if (page === 1) setInitialLoading(true);
    else setLoadingMore(true);
    setErrorMessage(null);

    browseItems({
      search: debouncedSearch || undefined,
      category: category || undefined,
      location: location || undefined,
      borrowType: (borrowType as BorrowType) || undefined,
      sort,
      page,
      limit: PAGE_SIZE,
    })
      .then((result) => {
        if (requestIdRef.current !== requestId) return;
        setItems((prev) => (page === 1 ? result.items : [...prev, ...result.items]));
        setPagination(result.pagination);
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return;
        setErrorMessage(err instanceof ApiError ? err.message : 'Could not load items. Please try again.');
      })
      .finally(() => {
        if (requestIdRef.current !== requestId) return;
        setInitialLoading(false);
        setLoadingMore(false);
      });
  }, [debouncedSearch, category, location, borrowType, sort, page]);

  function clearFilters() {
    setCategory('');
    setLocation('');
    setBorrowType('');
  }

  const canLoadMore = pagination ? page < pagination.totalPages : false;
  const resultLabel = pagination
    ? `${pagination.totalItems} item${pagination.totalItems === 1 ? '' : 's'} available near campus`
    : '';

  return (
    <main className="mx-auto max-w-6xl px-5 py-7">
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h2 className="text-[32px]">Explore items</h2>
          <p className="mt-1 text-sm text-ink/60">{resultLabel}</p>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 rounded-full border border-ink/15 px-4 py-2.5 text-sm font-bold lg:hidden"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M3 6h18M6 12h12M10 18h4" />
          </svg>
          Filters
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-2.5">
        <SearchBar value={search} onChange={setSearch} placeholder="Search calculators, books, cameras…" />
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as SortOption)}
          className="rounded-full border border-ink/12 bg-white px-4 py-2.5 text-sm font-semibold text-ink"
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price (low to high)</option>
          <option value="price_desc">Price (high to low)</option>
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        <aside className="sticky top-[76px] hidden self-start rounded-card border border-ink/10 bg-white p-5 lg:block">
          <FilterPanel
            category={category}
            location={location}
            borrowType={borrowType}
            onCategoryChange={setCategory}
            onLocationChange={setLocation}
            onBorrowTypeChange={setBorrowType}
            onClear={clearFilters}
          />
        </aside>

        <div>
          {errorMessage && (
            <p className="mb-4 rounded-2xl bg-danger-bg px-4 py-2.5 text-sm font-medium text-danger-text">{errorMessage}</p>
          )}

          {initialLoading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
              {SKELETONS.map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No items match those filters"
              description="Try a different category or widen your locations — new listings appear every day."
              actionLabel="Clear all filters"
              onAction={clearFilters}
            />
          ) : (
            <>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                {items.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
              {canLoadMore && (
                <div className="mt-7 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={loadingMore}
                    className="rounded-full border border-ink/15 bg-white px-7 py-3 text-sm font-bold transition-colors hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingMore ? 'Loading…' : 'Load more items'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-[60] bg-ink/45" onClick={() => setDrawerOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 z-[61] max-h-[82vh] overflow-auto rounded-t-card bg-white p-5 pb-7">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15" />
            <FilterPanel
              category={category}
              location={location}
              borrowType={borrowType}
              onCategoryChange={setCategory}
              onLocationChange={setLocation}
              onBorrowTypeChange={setBorrowType}
              onClear={clearFilters}
            />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="mt-2 w-full rounded-full bg-primary py-3.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
            >
              Show {pagination?.totalItems ?? 0} items
            </button>
          </div>
        </>
      )}
    </main>
  );
}
