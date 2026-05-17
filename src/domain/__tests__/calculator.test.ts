import { evaluateMoneyExpression } from '../calculator';

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
});
