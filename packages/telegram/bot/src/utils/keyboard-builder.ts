import type TelegramBot from 'node-telegram-bot-api';

export class KeyboardBuilder {
  inline(
    buttons: TelegramBot.InlineKeyboardButton[][],
  ): TelegramBot.InlineKeyboardMarkup {
    return { inline_keyboard: buttons };
  }

  reply(
    buttons: string[][],
    options?: { resizeKeyboard?: boolean; oneTimeKeyboard?: boolean; selective?: boolean },
  ): TelegramBot.ReplyKeyboardMarkup {
    return {
      keyboard: buttons.map((row) => row.map((text) => ({ text }))),
      resize_keyboard: options?.resizeKeyboard ?? true,
      one_time_keyboard: options?.oneTimeKeyboard ?? false,
      selective: options?.selective ?? false,
    };
  }

  remove(selective?: boolean): TelegramBot.ReplyKeyboardRemove {
    return { remove_keyboard: true, selective: selective ?? false };
  }
}
