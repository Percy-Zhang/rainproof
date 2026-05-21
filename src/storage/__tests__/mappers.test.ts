import {
  mapAccount,
  mapRainyDayFund,
  mapTransaction,
  mapTransactionLine,
  mapTransactionLink,
  safeParseCurrencyCodes,
  safeParseLabels,
  safeParseNullableStringArray,
} from '../mappers';

describe('storage mappers', () => {
  it('maps account rows to the domain account shape with normalized defaults', () => {
    expect(
      mapAccount({
        id: 'acct-1',
        name: 'Everyday',
        nickname: '',
        type: 'checking',
        currency_code: 'aud',
        opening_balance_minor: 12345,
        notes: 'Daily',
        institution_name: 'Bank',
        include_in_rainy_day: 1,
        theme_color: 'bad',
        icon_name: 'not-real',
        show_on_dashboard: 0,
        sort_order: 3,
        is_archived: 1,
        created_at: '2026-05-17T00:00:00.000Z',
        updated_at: '2026-05-17T00:00:00.000Z',
      }),
    ).toEqual(
      expect.objectContaining({
        currencyCode: 'AUD',
        includeInRainyDay: true,
        isArchived: true,
        showOnDashboard: false,
        themeColor: '#1876A8',
        iconName: 'business-outline',
      }),
    );
  });

  it('maps transaction rows and filters bad labels', () => {
    expect(
      mapTransaction({
        id: 'txn-1',
        kind: 'expense',
        title: 'Groceries',
        datetime: '2026-05-17T10:00:00.000Z',
        notes: '',
        labels_json: '["weekly", 1, "food"]',
        group_id: 'home',
        created_at: '2026-05-17T10:00:00.000Z',
        updated_at: '2026-05-17T10:00:00.000Z',
      }),
    ).toEqual(
      expect.objectContaining({
        labels: ['weekly', 'food'],
        groupId: 'home',
      }),
    );
  });

  it('maps transaction line and link rows', () => {
    expect(
      mapTransactionLine({
        id: 'line-1',
        transaction_id: 'txn-1',
        account_id: 'acct-1',
        amount_minor: -1299,
        currency_code: 'usd',
        category_id: 'food-dining',
        subcategory_id: 'groceries',
        external_party: '',
        transfer_peer_account_id: '',
        note: '',
        created_at: '2026-05-17T10:00:00.000Z',
      }),
    ).toEqual(expect.objectContaining({ amountMinor: -1299, currencyCode: 'USD' }));

    expect(
      mapTransactionLink({
        id: 'link-1',
        source_transaction_id: 'income-1',
        target_transaction_id: 'expense-1',
        source_line_id: 'income-line-1',
        target_line_id: 'expense-line-1',
        link_type: 'refund',
        amount_minor: 500,
        currency_code: 'aud',
        created_at: '2026-05-17T10:00:00.000Z',
        updated_at: '2026-05-17T10:00:00.000Z',
      }),
    ).toEqual(
      expect.objectContaining({
        sourceTransactionId: 'income-1',
        targetTransactionId: 'expense-1',
        sourceLineId: 'income-line-1',
        targetLineId: 'expense-line-1',
        linkType: 'refund',
        currencyCode: 'AUD',
      }),
    );
  });

  it('maps rainy day funds with linked account ids', () => {
    expect(
      mapRainyDayFund(
        {
          id: 'fund-1',
          name: 'Rainy day fund',
          currency_code: 'nzd',
          goal_minor: 100000,
          created_at: '2026-05-17T10:00:00.000Z',
          updated_at: '2026-05-17T10:00:00.000Z',
        },
        ['acct-1', 'acct-2'],
      ),
    ).toEqual(expect.objectContaining({ currencyCode: 'NZD', linkedAccountIds: ['acct-1', 'acct-2'] }));
  });

  it('parses storage JSON fields defensively', () => {
    expect(safeParseLabels('bad')).toEqual([]);
    expect(safeParseCurrencyCodes('["AUD", 1, "USD"]')).toEqual(['AUD', 'USD']);
    expect(safeParseNullableStringArray(undefined)).toBeNull();
    expect(safeParseNullableStringArray('["acct-1", false]')).toEqual(['acct-1']);
  });
});
