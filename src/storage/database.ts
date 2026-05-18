import type * as SQLite from 'expo-sqlite';

export type RepositoryDatabase = Pick<
  SQLite.SQLiteDatabase,
  'execAsync' | 'getAllAsync' | 'getFirstAsync' | 'runAsync' | 'withTransactionAsync'
>;
