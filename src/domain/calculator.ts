type Operator = '+' | '-' | '*' | '/';

export type CalculatorKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '.'
  | '/'
  | '*'
  | '-'
  | '+'
  | '='
  | 'backspace';

export type CalculatorAmountInputState = {
  expression: string;
  replaceOnNextEntry: boolean;
};

type Token =
  | { type: 'amount'; valueMinor: number }
  | { type: 'operator'; value: Operator };

const precedence: Record<Operator, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
};

export function getInitialCalculatorAmountInputState(expression: string): CalculatorAmountInputState {
  return {
    expression,
    replaceOnNextEntry: Boolean(expression.trim()),
  };
}

export function applyCalculatorAmountKey(
  state: CalculatorAmountInputState,
  key: CalculatorKey,
): CalculatorAmountInputState {
  if (key === 'backspace') {
    return {
      expression: state.expression.slice(0, -1),
      replaceOnNextEntry: false,
    };
  }

  if (key === '=') {
    return {
      expression: evaluateMoneyExpression(state.expression),
      replaceOnNextEntry: false,
    };
  }

  if (state.replaceOnNextEntry && isAmountEntryKey(key)) {
    return {
      expression: key === '.' ? '0.' : key,
      replaceOnNextEntry: false,
    };
  }

  return {
    expression: appendCalculatorKey(state.expression, key),
    replaceOnNextEntry: false,
  };
}

export function evaluateMoneyExpression(input: string): string {
  if (/[+\-*/]\s*$/.test(input)) {
    throw new Error('Finish the calculation before saving.');
  }

  const tokens = tokenize(input);
  if (!tokens.length || tokens[tokens.length - 1].type === 'operator') {
    throw new Error('Finish the calculation before saving.');
  }

  const values: number[] = [];
  const operators: Operator[] = [];

  for (const token of tokens) {
    if (token.type === 'amount') {
      values.push(token.valueMinor);
      continue;
    }

    while (
      operators.length &&
      precedence[operators[operators.length - 1]] >= precedence[token.value]
    ) {
      applyOperator(values, operators.pop() as Operator);
    }
    operators.push(token.value);
  }

  while (operators.length) {
    applyOperator(values, operators.pop() as Operator);
  }

  if (values.length !== 1) {
    throw new Error('Enter a valid calculation.');
  }

  return formatCalculatorAmount(values[0]);
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let buffer = '';

  for (const character of input.replace(/\s/g, '')) {
    if (isOperator(character)) {
      pushAmount(tokens, buffer);
      buffer = '';
      tokens.push({ type: 'operator', value: character });
      continue;
    }

    if (!/[\d.]/.test(character)) {
      throw new Error('Use numbers and calculator operators only.');
    }

    buffer += character;
  }

  pushAmount(tokens, buffer);
  return tokens;
}

function pushAmount(tokens: Token[], value: string): void {
  if (!value) {
    if (!tokens.length) {
      return;
    }

    throw new Error('Enter a valid calculation.');
  }

  const match = value.match(/^(?:(\d+)(?:\.(\d{0,2}))?|\.(\d{1,2}))$/);
  if (!match) {
    throw new Error('Enter amounts with up to 2 decimal places.');
  }

  const [, whole = '0', centsOnly = ''] = match;
  tokens.push({
    type: 'amount',
    valueMinor: Number(whole) * 100 + Number(centsOnly.padEnd(2, '0')),
  });
}

function applyOperator(values: number[], operator: Operator): void {
  const right = values.pop();
  const left = values.pop();

  if (left === undefined || right === undefined) {
    throw new Error('Enter a valid calculation.');
  }

  if (operator === '+') {
    values.push(left + right);
    return;
  }

  if (operator === '-') {
    values.push(left - right);
    return;
  }

  if (operator === '*') {
    values.push(Math.round((left * right) / 100));
    return;
  }

  if (right === 0) {
    throw new Error('Cannot divide by zero.');
  }
  values.push(Math.round((left * 100) / right));
}

function formatCalculatorAmount(amountMinor: number): string {
  const sign = amountMinor < 0 ? '-' : '';
  const absolute = Math.abs(amountMinor);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

function isOperator(value: string): value is Operator {
  return value === '+' || value === '-' || value === '*' || value === '/';
}

function isAmountEntryKey(key: CalculatorKey): boolean {
  return key === '.' || /^\d$/.test(key);
}

function appendCalculatorKey(expression: string, key: Exclude<CalculatorKey, '=' | 'backspace'>): string {
  if (/^\d$/.test(key) && expression === '0') {
    return key;
  }

  return `${expression}${key}`;
}
