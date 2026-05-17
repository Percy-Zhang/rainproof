import {
  applyLabelSuggestion,
  getLabelAutocompleteOptions,
  parseLabelsInput,
} from '../labels';

describe('label helpers', () => {
  it('trims labels and removes duplicates case-insensitively', () => {
    expect(parseLabelsInput(' holiday, tax, Holiday, , shared ')).toEqual(['holiday', 'tax', 'shared']);
  });

  it('suggests matching labels from the active comma segment', () => {
    expect(getLabelAutocompleteOptions(['holiday', 'tax', 'holiday', 'shared'], 'tax, ho')).toEqual(['holiday']);
  });

  it('does not suggest labels already selected', () => {
    expect(getLabelAutocompleteOptions(['holiday', 'tax'], 'holiday, ta')).toEqual(['tax']);
    expect(getLabelAutocompleteOptions(['holiday', 'tax'], 'holiday')).toEqual([]);
  });

  it('applies a suggestion without duplicating existing labels', () => {
    expect(applyLabelSuggestion('tax, ho', 'holiday')).toBe('tax, holiday');
    expect(applyLabelSuggestion('holiday, ho', 'holiday')).toBe('holiday');
  });
});
