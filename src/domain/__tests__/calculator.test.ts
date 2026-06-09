import {
  applyCalculatorAmountKey,
  evaluateMoneyExpression,
  getInitialCalculatorAmountInputState,
} from '../calculator';

describe('calculator', () => {
  it('evaluates calculator expressions to two decimal amount strings', () => {
    expect(evaluateMoneyExpression('12.50+7.25')).toBe('19.75');
    expect(evaluateMoneyExpression('10*2+1.50')).toBe('21.50');
    expect(evaluateMoneyExpression('10/4')).toBe('2.50');
  });

  it('rejects incomplete or unsafe calculations', () => {
    expect(() => evaluateMoneyExpression('12+')).toThrow('Finish');
    expect(() => evaluateMoneyExpression('12/0')).toThrow('divide by zero');
  });

  it('replaces a prefilled amount on the first typed digit, then edits normally', () => {
    const initial = getInitialCalculatorAmountInputState('9.24');
    const firstDigit = applyCalculatorAmountKey(initial, '5');
    const decimal = applyCalculatorAmountKey(firstDigit, '.');
    const cents = applyCalculatorAmountKey(
      applyCalculatorAmountKey(decimal, '3'),
      '4',
    );

    expect(initial.replaceOnNextEntry).toBe(true);
    expect(firstDigit).toEqual({
      expression: '5',
      replaceOnNextEntry: false,
    });
    expect(cents.expression).toBe('5.34');
  });

  it('does not repeatedly replace a user-edited amount', () => {
    const edited = applyCalculatorAmountKey(
      getInitialCalculatorAmountInputState('9.24'),
      '5',
    );

    expect(applyCalculatorAmountKey(edited, '3').expression).toBe('53');
  });

  it('keeps backspace and decimal entry behavior predictable', () => {
    expect(
      applyCalculatorAmountKey(
        getInitialCalculatorAmountInputState('9.24'),
        'backspace',
      ),
    ).toEqual({
      expression: '9.2',
      replaceOnNextEntry: false,
    });
    expect(
      applyCalculatorAmountKey(
        getInitialCalculatorAmountInputState('9.24'),
        '.',
      ).expression,
    ).toBe('0.');
    expect(
      applyCalculatorAmountKey(
        { expression: '0', replaceOnNextEntry: false },
        '5',
      ).expression,
    ).toBe('5');
  });
});
