import { act, renderHook } from '@testing-library/react-native';

import { TRANSACTION_LINK_CANDIDATE_PAGE_SIZE } from '../../../domain/transactionLinkCandidateModel';
import { useTransactionLinkCandidateDiscovery } from '../useTransactionLinkCandidateDiscovery';

describe('useTransactionLinkCandidateDiscovery', () => {
  it('applies the latest filter immediately and resets pagination synchronously', () => {
    const { result } = renderHook(() => useTransactionLinkCandidateDiscovery(true));

    act(() => {
      result.current.beginPaginationScroll();
      result.current.revealNextPage(100);
    });
    expect(result.current.visibleCount).toBe(TRANSACTION_LINK_CANDIDATE_PAGE_SIZE * 2);

    act(() => {
      result.current.setFilter('partial');
      result.current.setFilter('settled');
      result.current.setFilter('all');
    });

    expect(result.current.filter).toBe('all');
    expect(result.current.visibleCount).toBe(TRANSACTION_LINK_CANDIDATE_PAGE_SIZE);
  });

  it('requires scroll intent, reveals one page per gesture, and stops at the total', () => {
    const { result } = renderHook(() => useTransactionLinkCandidateDiscovery(true));

    act(() => {
      result.current.revealNextPage(45);
      result.current.revealNextPage(45);
    });
    expect(result.current.visibleCount).toBe(20);

    act(() => {
      result.current.beginPaginationScroll();
      result.current.revealNextPage(45);
      result.current.revealNextPage(45);
    });
    expect(result.current.visibleCount).toBe(40);

    act(() => {
      result.current.beginPaginationScroll();
      result.current.revealNextPage(45);
    });
    expect(result.current.visibleCount).toBe(45);

    act(() => {
      result.current.beginPaginationScroll();
      result.current.revealNextPage(45);
    });
    expect(result.current.visibleCount).toBe(45);
  });

  it('resets pagination immediately when search input changes', () => {
    const { result } = renderHook(() => useTransactionLinkCandidateDiscovery(true));

    act(() => {
      result.current.beginPaginationScroll();
      result.current.revealNextPage(100);
    });
    expect(result.current.visibleCount).toBe(40);

    act(() => result.current.setQuery('refund'));
    expect(result.current.query).toBe('refund');
    expect(result.current.visibleCount).toBe(TRANSACTION_LINK_CANDIDATE_PAGE_SIZE);
  });

  it('cancels pending pagination intent when the filter changes', () => {
    const { result } = renderHook(() => useTransactionLinkCandidateDiscovery(true));

    act(() => {
      result.current.beginPaginationScroll();
      result.current.setFilter('partial');
      result.current.revealNextPage(100);
    });

    expect(result.current.filter).toBe('partial');
    expect(result.current.visibleCount).toBe(TRANSACTION_LINK_CANDIDATE_PAGE_SIZE);
  });
});
