import { validateTransactionLinkInput, type ValidatedTransactionLinkInput } from '../domain/transactionLinks';
import { normalizeCurrencyCode } from '../domain/money';
import type {
  NewTransactionLinkInput,
  Transaction,
  TransactionLine,
  TransactionLinkBatchInput,
  TransactionLink,
  UpdateTransactionLinkInput,
} from '../domain/types';
import { logDevPerfDuration, timeDevPerfAsync } from '../performance';
import type { RepositoryDatabase } from './database';
import { createLocalId } from './ids';
import {
  mapTransaction,
  mapTransactionLine,
  mapTransactionLink,
  type TransactionLineRow,
  type TransactionLinkRow,
  type TransactionRow,
} from './mappers';

export type TransactionLinkValidationState = {
  transactions: Transaction[];
  lines: TransactionLine[];
  links: TransactionLink[];
};

type TransactionLinkStorageValidationState = TransactionLinkValidationState & {
  readMode: 'targeted';
};

type CreateTransactionLinkStorageRecordOptions = {
  createdAt?: string;
  linkId?: string;
  updatedAt?: string;
};

type CreateUpdateTransactionLinkStorageRecordOptions = {
  updatedAt?: string;
};

export type TransactionLinkBatchStorageRecords = {
  addedLinks: TransactionLink[];
  deletedLinkIds: string[];
  updatedLinks: TransactionLink[];
};

export function createAddTransactionLinkStorageRecord(
  input: NewTransactionLinkInput,
  validationState: TransactionLinkValidationState,
  options: CreateTransactionLinkStorageRecordOptions = {},
): TransactionLink {
  const validated = validateTransactionLinkInput({
    input,
    transactions: validationState.transactions,
    lines: validationState.lines,
    existingLinks: validationState.links,
  });
  const now = options.createdAt ?? new Date().toISOString();

  return createTransactionLinkRecordFromValidated(validated, {
    createdAt: now,
    id: options.linkId ?? createLocalId('link'),
    updatedAt: options.updatedAt ?? now,
  });
}

export function createUpdateTransactionLinkStorageRecord(
  input: UpdateTransactionLinkInput,
  existingLink: TransactionLink,
  validationState: TransactionLinkValidationState,
  options: CreateUpdateTransactionLinkStorageRecordOptions = {},
): TransactionLink {
  if (input.id !== existingLink.id) {
    throw new Error('Prepared transaction link does not match the link id.');
  }

  const validated = validateTransactionLinkInput({
    input,
    transactions: validationState.transactions,
    lines: validationState.lines,
    existingLinks: validationState.links,
    currentLinkId: input.id,
  });

  return createTransactionLinkRecordFromValidated(validated, {
    createdAt: existingLink.createdAt,
    id: input.id,
    updatedAt: options.updatedAt ?? new Date().toISOString(),
  });
}

export function createTransactionLinkBatchStorageRecords(
  input: TransactionLinkBatchInput,
  validationState: TransactionLinkValidationState,
  options: CreateTransactionLinkStorageRecordOptions = {},
): TransactionLinkBatchStorageRecords {
  const now = options.updatedAt ?? options.createdAt ?? new Date().toISOString();
  const deleteIds = uniqueIds(input.deleteIds);
  const updateIds = uniqueIds(input.toUpdate.map((linkInput) => linkInput.id));
  const existingLinksById = new Map(validationState.links.map((link) => [link.id, link]));

  if (updateIds.length !== input.toUpdate.length) {
    throw new Error('Transaction link batch cannot update the same link more than once.');
  }

  if (updateIds.some((linkId) => deleteIds.includes(linkId))) {
    throw new Error('Transaction link batch cannot update and delete the same link.');
  }

  const updatedLinks = input.toUpdate.map((linkInput) => {
    const existingLink = existingLinksById.get(linkInput.id);
    if (!existingLink) {
      throw new Error('Transaction link not found.');
    }

    return createUnvalidatedTransactionLinkRecord(linkInput, {
      createdAt: existingLink.createdAt,
      id: linkInput.id,
      updatedAt: now,
    });
  });

  const addedLinks = input.toAdd.map((linkInput) =>
    createUnvalidatedTransactionLinkRecord(linkInput, {
      createdAt: options.createdAt ?? now,
      id: createLocalId('link'),
      updatedAt: options.updatedAt ?? now,
    }));

  const finalLinks = [
    ...validationState.links.filter((link) => !deleteIds.includes(link.id) && !updateIds.includes(link.id)),
    ...updatedLinks,
    ...addedLinks,
  ];

  for (const link of updatedLinks) {
    validateBatchTransactionLinkRecord(link, validationState, finalLinks);
  }

  for (const link of addedLinks) {
    validateBatchTransactionLinkRecord(link, validationState, finalLinks);
  }

  return {
    addedLinks,
    deletedLinkIds: deleteIds,
    updatedLinks,
  };
}

export async function addTransactionLinkStorage(
  db: RepositoryDatabase,
  input: NewTransactionLinkInput,
  preparedLink?: TransactionLink,
): Promise<TransactionLink> {
  let persistedLink: TransactionLink | null = null;

  await db.withTransactionAsync(async () => {
    const { validated, validationState } = await validateTransactionLinkForStorage(db, input);
    const link = preparedLink ?? createAddTransactionLinkStorageRecord(input, validationState);
    validatePreparedTransactionLinkRecord(link, validated);

    await db.runAsync(
      `INSERT INTO transaction_links (
        id, source_transaction_id, target_transaction_id, source_line_id, target_line_id,
        link_type, amount_minor, currency_code, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      link.id,
      link.sourceTransactionId,
      link.targetTransactionId,
      link.sourceLineId ?? null,
      link.targetLineId ?? null,
      link.linkType,
      link.amountMinor,
      link.currencyCode,
      link.createdAt,
      link.updatedAt,
    );
    persistedLink = link;
  });

  if (!persistedLink) {
    throw new Error('Transaction link was not saved.');
  }

  return persistedLink;
}

export async function updateTransactionLinkStorage(
  db: RepositoryDatabase,
  input: UpdateTransactionLinkInput,
  preparedLink?: TransactionLink,
): Promise<TransactionLink> {
  let persistedLink: TransactionLink | null = null;

  await db.withTransactionAsync(async () => {
    const existingLinkRow = await db.getFirstAsync<TransactionLinkRow>(
      'SELECT * FROM transaction_links WHERE id = ?',
      input.id,
    );
    if (!existingLinkRow) {
      throw new Error('Transaction link not found.');
    }
    const existingLink = mapTransactionLink(existingLinkRow);

    const { validated, validationState } = await validateTransactionLinkForStorage(db, input, input.id);
    const link = preparedLink ?? createUpdateTransactionLinkStorageRecord(input, existingLink, validationState);
    validatePreparedTransactionLinkRecord(link, validated, {
      createdAt: existingLink.createdAt,
      id: input.id,
    });

    await db.runAsync(
      `UPDATE transaction_links
       SET source_transaction_id = ?, target_transaction_id = ?, source_line_id = ?, target_line_id = ?,
           link_type = ?, amount_minor = ?, currency_code = ?, updated_at = ?
       WHERE id = ?`,
      link.sourceTransactionId,
      link.targetTransactionId,
      link.sourceLineId ?? null,
      link.targetLineId ?? null,
      link.linkType,
      link.amountMinor,
      link.currencyCode,
      link.updatedAt,
      input.id,
    );
    persistedLink = link;
  });

  if (!persistedLink) {
    throw new Error('Transaction link was not updated.');
  }

  return persistedLink;
}

export async function deleteTransactionLinkStorage(
  db: RepositoryDatabase,
  linkId: string,
): Promise<void> {
  await db.runAsync('DELETE FROM transaction_links WHERE id = ?', linkId);
}

export async function saveTransactionLinkBatchStorage(
  db: RepositoryDatabase,
  input: TransactionLinkBatchInput,
  preparedRecords?: TransactionLinkBatchStorageRecords,
): Promise<TransactionLinkBatchStorageRecords> {
  let persistedRecords: TransactionLinkBatchStorageRecords | null = null;

  await db.withTransactionAsync(async () => {
    const validationState = await getTransactionLinkValidationStateForBatch(db, input);
    const records = preparedRecords ?? createTransactionLinkBatchStorageRecords(input, validationState);
    validatePreparedTransactionLinkBatchRecords(input, records, validationState);

    for (const linkId of records.deletedLinkIds) {
      await db.runAsync('DELETE FROM transaction_links WHERE id = ?', linkId);
    }

    for (const link of records.updatedLinks) {
      await db.runAsync(
        `UPDATE transaction_links
         SET source_transaction_id = ?, target_transaction_id = ?, source_line_id = ?, target_line_id = ?,
             link_type = ?, amount_minor = ?, currency_code = ?, updated_at = ?
         WHERE id = ?`,
        link.sourceTransactionId,
        link.targetTransactionId,
        link.sourceLineId ?? null,
        link.targetLineId ?? null,
        link.linkType,
        link.amountMinor,
        link.currencyCode,
        link.updatedAt,
        link.id,
      );
    }

    for (const link of records.addedLinks) {
      await db.runAsync(
        `INSERT INTO transaction_links (
          id, source_transaction_id, target_transaction_id, source_line_id, target_line_id,
          link_type, amount_minor, currency_code, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        link.id,
        link.sourceTransactionId,
        link.targetTransactionId,
        link.sourceLineId ?? null,
        link.targetLineId ?? null,
        link.linkType,
        link.amountMinor,
        link.currencyCode,
        link.createdAt,
        link.updatedAt,
      );
    }

    persistedRecords = records;
  });

  if (!persistedRecords) {
    throw new Error('Transaction links were not saved.');
  }

  return persistedRecords;
}

export async function getTransactionLinksStorage(db: RepositoryDatabase): Promise<TransactionLink[]> {
  const rows = await db.getAllAsync<TransactionLinkRow>(
    'SELECT * FROM transaction_links ORDER BY created_at ASC, id ASC',
  );
  return rows.map(mapTransactionLink);
}

export async function getTransactionLinksForSourceTransactionStorage(
  db: RepositoryDatabase,
  transactionId: string,
): Promise<TransactionLink[]> {
  const rows = await db.getAllAsync<TransactionLinkRow>(
    'SELECT * FROM transaction_links WHERE source_transaction_id = ? ORDER BY created_at ASC, id ASC',
    transactionId,
  );
  return rows.map(mapTransactionLink);
}

export async function getTransactionLinksForTargetTransactionStorage(
  db: RepositoryDatabase,
  transactionId: string,
): Promise<TransactionLink[]> {
  const rows = await db.getAllAsync<TransactionLinkRow>(
    'SELECT * FROM transaction_links WHERE target_transaction_id = ? ORDER BY created_at ASC, id ASC',
    transactionId,
  );
  return rows.map(mapTransactionLink);
}

export async function getTransactionLinksForTransactionStorage(
  db: RepositoryDatabase,
  transactionId: string,
): Promise<TransactionLink[]> {
  const rows = await db.getAllAsync<TransactionLinkRow>(
    `SELECT * FROM transaction_links
     WHERE source_transaction_id = ? OR target_transaction_id = ?
     ORDER BY created_at ASC, id ASC`,
    transactionId,
    transactionId,
  );
  return rows.map(mapTransactionLink);
}

export async function removeTransactionLinksForTransactionStorage(
  db: RepositoryDatabase,
  transactionId: string,
): Promise<void> {
  await db.runAsync(
    'DELETE FROM transaction_links WHERE source_transaction_id = ? OR target_transaction_id = ?',
    transactionId,
    transactionId,
  );
}

async function validateTransactionLinkForStorage(
  db: RepositoryDatabase,
  input: NewTransactionLinkInput | UpdateTransactionLinkInput,
  currentLinkId?: string,
): Promise<{
  validated: ValidatedTransactionLinkInput;
  validationState: TransactionLinkValidationState;
}> {
  const startedAt = Date.now();
  const validationState = await getTransactionLinkValidationState(db, input, currentLinkId);
  const { transactions, lines, links } = validationState;
  const validated = validateTransactionLinkInput({
    input,
    transactions,
    lines,
    existingLinks: links,
    currentLinkId,
  });

  logDevPerfDuration('transactionLinks.validation.total', startedAt, {
    transactions: transactions.length,
    lines: lines.length,
    links: links.length,
    mode: validationState.readMode,
  });

  return { validated, validationState };
}

async function getTransactionLinkValidationState(
  db: RepositoryDatabase,
  input: NewTransactionLinkInput | UpdateTransactionLinkInput,
  currentLinkId?: string,
): Promise<TransactionLinkStorageValidationState> {
  return timeDevPerfAsync(
    'transactionLinks.validationState.read',
    () => getTargetedTransactionLinkValidationState(db, input, currentLinkId),
    (state) => ({
      transactions: state.transactions.length,
      lines: state.lines.length,
      links: state.links.length,
      mode: state.readMode,
    }),
  );
}

async function getTransactionLinkValidationStateForBatch(
  db: RepositoryDatabase,
  input: TransactionLinkBatchInput,
): Promise<TransactionLinkStorageValidationState> {
  return timeDevPerfAsync(
    'transactionLinks.validationState.read',
    () => getTargetedTransactionLinkValidationStateForBatch(db, input),
    (state) => ({
      transactions: state.transactions.length,
      lines: state.lines.length,
      links: state.links.length,
      mode: state.readMode,
    }),
  );
}

async function getTargetedTransactionLinkValidationState(
  db: RepositoryDatabase,
  input: NewTransactionLinkInput | UpdateTransactionLinkInput,
  currentLinkId?: string,
): Promise<TransactionLinkStorageValidationState> {
  const sourceTransactionId = input.sourceTransactionId.trim();
  const targetTransactionId = input.targetTransactionId.trim();
  const transactionIds = uniqueIds([sourceTransactionId, targetTransactionId]);
  const lineIds = uniqueIds([
    normalizeOptionalId(input.sourceLineId),
    normalizeOptionalId(input.targetLineId),
  ]);

  const transactionRows = await getTransactionRowsByIds(db, transactionIds);
  const lineRows = await getTransactionLineRowsForLinkValidation(db, transactionIds, lineIds);
  const linkRows = await getTransactionLinkRowsForLinkValidation(db, transactionIds, lineIds, currentLinkId);

  return {
    transactions: transactionRows.map(mapTransaction),
    lines: lineRows.map(mapTransactionLine),
    links: linkRows.map(mapTransactionLink),
    readMode: 'targeted',
  };
}

async function getTargetedTransactionLinkValidationStateForBatch(
  db: RepositoryDatabase,
  input: TransactionLinkBatchInput,
): Promise<TransactionLinkStorageValidationState> {
  const linkInputs = [...input.toAdd, ...input.toUpdate];
  const transactionIds = uniqueIds(linkInputs.flatMap((linkInput) => [
    linkInput.sourceTransactionId.trim(),
    linkInput.targetTransactionId.trim(),
  ]));
  const lineIds = uniqueIds(linkInputs.flatMap((linkInput) => [
    normalizeOptionalId(linkInput.sourceLineId),
    normalizeOptionalId(linkInput.targetLineId),
  ]));
  const linkIds = uniqueIds([
    ...input.toUpdate.map((linkInput) => linkInput.id),
    ...input.deleteIds,
  ]);

  const transactionRows = await getTransactionRowsByIds(db, transactionIds);
  const lineRows = await getTransactionLineRowsForLinkValidation(db, transactionIds, lineIds);
  const linkRows = await getTransactionLinkRowsForLinkValidation(db, transactionIds, lineIds, linkIds);

  return {
    transactions: transactionRows.map(mapTransaction),
    lines: lineRows.map(mapTransactionLine),
    links: linkRows.map(mapTransactionLink),
    readMode: 'targeted',
  };
}

async function getTransactionRowsByIds(
  db: RepositoryDatabase,
  transactionIds: string[],
): Promise<TransactionRow[]> {
  if (!transactionIds.length) {
    return [];
  }

  return db.getAllAsync<TransactionRow>(
    `SELECT * FROM transactions WHERE id IN (${createPlaceholders(transactionIds.length)})`,
    ...transactionIds,
  );
}

async function getTransactionLineRowsForLinkValidation(
  db: RepositoryDatabase,
  transactionIds: string[],
  lineIds: string[],
): Promise<TransactionLineRow[]> {
  const clauses: string[] = [];
  const params: string[] = [];

  if (transactionIds.length) {
    clauses.push(`transaction_id IN (${createPlaceholders(transactionIds.length)})`);
    params.push(...transactionIds);
  }

  if (lineIds.length) {
    clauses.push(`id IN (${createPlaceholders(lineIds.length)})`);
    params.push(...lineIds);
  }

  if (!clauses.length) {
    return [];
  }

  return db.getAllAsync<TransactionLineRow>(
    `SELECT * FROM transaction_lines WHERE ${clauses.join(' OR ')}`,
    ...params,
  );
}

async function getTransactionLinkRowsForLinkValidation(
  db: RepositoryDatabase,
  transactionIds: string[],
  lineIds: string[],
  linkIds: string[] | string | undefined,
): Promise<TransactionLinkRow[]> {
  const clauses: string[] = [];
  const params: string[] = [];
  const normalizedLinkIds = Array.isArray(linkIds) ? uniqueIds(linkIds) : uniqueIds([linkIds]);

  if (transactionIds.length) {
    const placeholders = createPlaceholders(transactionIds.length);
    clauses.push(`source_transaction_id IN (${placeholders})`);
    params.push(...transactionIds);
    clauses.push(`target_transaction_id IN (${placeholders})`);
    params.push(...transactionIds);
  }

  if (lineIds.length) {
    const placeholders = createPlaceholders(lineIds.length);
    clauses.push(`source_line_id IN (${placeholders})`);
    params.push(...lineIds);
    clauses.push(`target_line_id IN (${placeholders})`);
    params.push(...lineIds);
  }

  if (normalizedLinkIds.length) {
    clauses.push(`id IN (${createPlaceholders(normalizedLinkIds.length)})`);
    params.push(...normalizedLinkIds);
  }

  if (!clauses.length) {
    return [];
  }

  return db.getAllAsync<TransactionLinkRow>(
    `SELECT * FROM transaction_links
     WHERE ${clauses.join(' OR ')}
     ORDER BY created_at ASC, id ASC`,
    ...params,
  );
}

function createPlaceholders(count: number): string {
  return Array(count).fill('?').join(', ');
}

function uniqueIds(ids: (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed || null;
}

function createUnvalidatedTransactionLinkRecord(
  input: NewTransactionLinkInput,
  identifiers: {
    createdAt: string;
    id: string;
    updatedAt: string;
  },
): TransactionLink {
  return {
    id: identifiers.id,
    sourceTransactionId: input.sourceTransactionId.trim(),
    targetTransactionId: input.targetTransactionId.trim(),
    sourceLineId: normalizeOptionalId(input.sourceLineId),
    targetLineId: normalizeOptionalId(input.targetLineId),
    linkType: input.linkType,
    amountMinor: input.amountMinor,
    currencyCode: normalizeCurrencyCode(input.currencyCode),
    createdAt: identifiers.createdAt,
    updatedAt: identifiers.updatedAt,
  };
}

function validateBatchTransactionLinkRecord(
  link: TransactionLink,
  validationState: TransactionLinkValidationState,
  finalLinks: TransactionLink[],
): void {
  const validated = validateTransactionLinkInput({
    input: transactionLinkToInput(link),
    transactions: validationState.transactions,
    lines: validationState.lines,
    existingLinks: finalLinks,
    currentLinkId: link.id,
  });

  validatePreparedTransactionLinkRecord(link, validated);
}

function validatePreparedTransactionLinkBatchRecords(
  input: TransactionLinkBatchInput,
  records: TransactionLinkBatchStorageRecords,
  validationState: TransactionLinkValidationState,
): void {
  const deleteIds = uniqueIds(input.deleteIds);
  if (JSON.stringify(records.deletedLinkIds) !== JSON.stringify(deleteIds)) {
    throw new Error('Prepared transaction link batch does not match deleted links.');
  }

  if (records.addedLinks.length !== input.toAdd.length || records.updatedLinks.length !== input.toUpdate.length) {
    throw new Error('Prepared transaction link batch does not match the input.');
  }

  const updateIds = uniqueIds(input.toUpdate.map((linkInput) => linkInput.id));
  const finalLinks = [
    ...validationState.links.filter((link) => !deleteIds.includes(link.id) && !updateIds.includes(link.id)),
    ...records.updatedLinks,
    ...records.addedLinks,
  ];

  records.addedLinks.forEach((link, index) => {
    validatePreparedTransactionLinkRecord(link, validateTransactionLinkInput({
      input: input.toAdd[index],
      transactions: validationState.transactions,
      lines: validationState.lines,
      existingLinks: finalLinks,
      currentLinkId: link.id,
    }));
  });

  records.updatedLinks.forEach((link, index) => {
    const existingLink = validationState.links.find((item) => item.id === input.toUpdate[index].id);
    if (!existingLink) {
      throw new Error('Transaction link not found.');
    }

    validatePreparedTransactionLinkRecord(link, validateTransactionLinkInput({
      input: input.toUpdate[index],
      transactions: validationState.transactions,
      lines: validationState.lines,
      existingLinks: finalLinks,
      currentLinkId: link.id,
    }), {
      createdAt: existingLink.createdAt,
      id: input.toUpdate[index].id,
    });
  });
}

function transactionLinkToInput(link: TransactionLink): NewTransactionLinkInput {
  return {
    sourceTransactionId: link.sourceTransactionId,
    targetTransactionId: link.targetTransactionId,
    sourceLineId: link.sourceLineId ?? null,
    targetLineId: link.targetLineId ?? null,
    linkType: link.linkType,
    amountMinor: link.amountMinor,
    currencyCode: link.currencyCode,
  };
}

function createTransactionLinkRecordFromValidated(
  validated: ValidatedTransactionLinkInput,
  identifiers: {
    createdAt: string;
    id: string;
    updatedAt: string;
  },
): TransactionLink {
  return {
    id: identifiers.id,
    sourceTransactionId: validated.sourceTransactionId,
    targetTransactionId: validated.targetTransactionId,
    sourceLineId: validated.sourceLineId,
    targetLineId: validated.targetLineId,
    linkType: validated.linkType,
    amountMinor: validated.amountMinor,
    currencyCode: validated.currencyCode,
    createdAt: identifiers.createdAt,
    updatedAt: identifiers.updatedAt,
  };
}

function validatePreparedTransactionLinkRecord(
  link: TransactionLink,
  validated: ValidatedTransactionLinkInput,
  expected?: {
    createdAt?: string;
    id?: string;
  },
): void {
  if (expected?.id && link.id !== expected.id) {
    throw new Error('Prepared transaction link does not match the link id.');
  }

  if (expected?.createdAt && link.createdAt !== expected.createdAt) {
    throw new Error('Prepared transaction link does not match the existing created date.');
  }

  if (
    link.sourceTransactionId !== validated.sourceTransactionId ||
    link.targetTransactionId !== validated.targetTransactionId ||
    (link.sourceLineId ?? null) !== validated.sourceLineId ||
    (link.targetLineId ?? null) !== validated.targetLineId ||
    link.linkType !== validated.linkType ||
    link.amountMinor !== validated.amountMinor ||
    link.currencyCode !== validated.currencyCode
  ) {
    throw new Error('Prepared transaction link does not match validated input.');
  }
}
