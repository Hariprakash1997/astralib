import { describe, it, expect, beforeEach } from 'vitest';
import { KeyboardBuilder } from '../utils/keyboard-builder';

describe('KeyboardBuilder', () => {
  let kb: KeyboardBuilder;

  beforeEach(() => {
    kb = new KeyboardBuilder();
  });

  describe('inline()', () => {
    it('returns InlineKeyboardMarkup with inline_keyboard', () => {
      const buttons = [
        [{ text: 'Button 1', callback_data: 'btn_1' }],
        [{ text: 'Button 2', callback_data: 'btn_2' }],
      ];
      const result = kb.inline(buttons);

      expect(result).toEqual({ inline_keyboard: buttons });
    });

    it('returns empty inline_keyboard for empty array', () => {
      const result = kb.inline([]);
      expect(result).toEqual({ inline_keyboard: [] });
    });

    it('preserves multiple buttons per row', () => {
      const buttons = [
        [
          { text: 'A', callback_data: 'a' },
          { text: 'B', callback_data: 'b' },
        ],
      ];
      const result = kb.inline(buttons);

      expect(result.inline_keyboard[0]).toHaveLength(2);
      expect(result.inline_keyboard[0][0].text).toBe('A');
      expect(result.inline_keyboard[0][1].text).toBe('B');
    });

    it('supports URL buttons', () => {
      const buttons = [[{ text: 'Visit', url: 'https://example.com' }]];
      const result = kb.inline(buttons);

      expect(result.inline_keyboard[0][0].url).toBe('https://example.com');
    });
  });

  describe('reply()', () => {
    it('returns ReplyKeyboardMarkup with keyboard', () => {
      const buttons = [['Option A', 'Option B'], ['Option C']];
      const result = kb.reply(buttons);

      expect(result.keyboard).toEqual([
        [{ text: 'Option A' }, { text: 'Option B' }],
        [{ text: 'Option C' }],
      ]);
    });

    it('defaults resize_keyboard to true', () => {
      const result = kb.reply([['A']]);
      expect(result.resize_keyboard).toBe(true);
    });

    it('defaults one_time_keyboard to false', () => {
      const result = kb.reply([['A']]);
      expect(result.one_time_keyboard).toBe(false);
    });

    it('defaults selective to false', () => {
      const result = kb.reply([['A']]);
      expect(result.selective).toBe(false);
    });

    it('respects resizeKeyboard option', () => {
      const result = kb.reply([['A']], { resizeKeyboard: false });
      expect(result.resize_keyboard).toBe(false);
    });

    it('respects oneTimeKeyboard option', () => {
      const result = kb.reply([['A']], { oneTimeKeyboard: true });
      expect(result.one_time_keyboard).toBe(true);
    });

    it('respects selective option', () => {
      const result = kb.reply([['A']], { selective: true });
      expect(result.selective).toBe(true);
    });

    it('maps string arrays to text objects', () => {
      const result = kb.reply([['Hello']]);
      expect(result.keyboard[0][0]).toEqual({ text: 'Hello' });
    });

    it('returns empty keyboard for empty array', () => {
      const result = kb.reply([]);
      expect(result.keyboard).toEqual([]);
    });
  });

  describe('remove()', () => {
    it('returns remove_keyboard: true', () => {
      const result = kb.remove();
      expect(result.remove_keyboard).toBe(true);
    });

    it('defaults selective to false', () => {
      const result = kb.remove();
      expect(result.selective).toBe(false);
    });

    it('respects selective parameter', () => {
      const result = kb.remove(true);
      expect(result.selective).toBe(true);
    });
  });
});
