import functions from '@google-cloud/functions-framework';
import TelegramBot, { CallbackQuery, Message } from 'node-telegram-bot-api';
import { Coach, type Response } from './coach.js';
import { Database } from "./database.js";

if (!process.env.TELEGRAM_SECRET) {
  throw new Error('TELEGRAM_SECRET is not defined');
}

const isLocal = process.env.LOCAL === 'true';
const bot = new TelegramBot(process.env.TELEGRAM_SECRET, { polling: isLocal });
const systemPrompt = "You are an IVF coach named Nia helping women dealing with maintaining a positive mindset during this difficult process of trying to conceive. Your goal is always to motivate your clients and keep them in a good mindset. You answer should contain the final message only";

const coach = new Coach({ name: 'Nia', role: systemPrompt });

coach.on('message', async (response: Response) => {
  if (response.type === 'text') {
    await bot.sendMessage(response.to, response.text);
  } else if (response.type === 'video') {
    await bot.sendVideo(response.to, response.url, { width: response.width, height: response.height });
  } else if (response.type === 'file') {
    await bot.sendDocument(response.to, response.path);
  }
})

const handleCommand = async (message: Message) => {
  const userId = message.chat.id.toString();
  const messageText = message.text;

  let userInfo = await Database.getUser(userId);
  if (!userInfo) {
    await Database.createUser(userId, message.chat.username || message.chat.first_name || '');
    userInfo = {
      id: userId,
      name: message.chat.username || message.chat.first_name,
      step: 0,
      createdAt: new Date(),
    };
  }

  if (messageText === '/start') {
    userInfo.step = 0;
    await Database.updateUser(userId, userInfo);
    await coach.sayHello(userId);
  } else if (messageText?.startsWith('/talk')) {
    const message = messageText.split('/talk')[1].trim();
    await coach.chat(userId, message)
  } else if (messageText === '/pdf_feature') {
    userInfo.step = 3;
    await Database.updateUser(userId, userInfo);
    await coach.askQuestionForMorningJournal(userId);
  }

}

const handleMessage = async (message: Message) => {
  const userId = message.chat.id.toString();
  const messageText = message.text;
  if (messageText?.startsWith('/')) {
    await handleCommand(message);
    return;
  }

  let userInfo = await Database.getUser(userId);
  if (!userInfo) {
    console.log('Creating user:', userId);
    await Database.createUser(userId, message.chat.username || message.chat.first_name || '');
    userInfo = {
      id: userId,
      name: message.chat.username || message.chat.first_name,
      step: 0,
      createdAt: new Date(),
    };
  }

  if (userInfo.step === 0 && messageText) {
    userInfo.name = messageText;
    userInfo.step = 1;
    await Database.updateUser(userId, userInfo);
    await bot.sendMessage(userId, `Thank you, ${userInfo.name}! I'm excited to begin this journey with you.`);
    await bot.sendMessage(userId, `As your personal coach, I'm here to support you in staying positive and balanced while trying to conceive. Mental well-being is incredibly important on this path, and together, we'll focus on keeping your mindset strong and resilient.`);
    await bot.sendMessage(userId, `Each day, I’ll send gentle reminders—like success stories to inspire you, positive affirmations, and guided meditation links to help you relax and refocus.`);
    await bot.sendMessage(userId, `Remember, this support complements but doesn’t replace therapy, so if you feel you need more, please reach out to a healthcare provider.`);
    await bot.sendMessage(userId, `To personalize this journey, I can send up to three reminders a day. How many would you like?`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '1', callback_data: 'setReminder-1' },
            { text: '2', callback_data: 'setReminder-2' },
            { text: '3', callback_data: 'setReminder-3' }
          ],
        ]
      }
    });
  } else if (userInfo.step === 1 && messageText) {
    const reminderCount = Number(messageText);
    if (reminderCount > 3 || reminderCount < 1 || isNaN(reminderCount)) {
      await bot.sendMessage(userId, `Please enter either 1, 2 or 3 to choose the amount of daily reminders you want to receive. Thank you 🌼`);
      return;
    } else {
      coach.createReminders(userId, userInfo.name, reminderCount);
    }
  } else if (userInfo.step === 2 && messageText) {
    await coach.chat(userId, messageText)
  } else if (userInfo.step === 3 && messageText) {
    const done = await coach.askQuestionForMorningJournal(userId, messageText)
    if (done) {
      userInfo.step = 2;
      await Database.updateUser(userId, userInfo);
    }
  }
}

const handleCallback = async (callbackQuery: CallbackQuery) => {
  const userId = callbackQuery.message!.chat.id.toString();

  const data = callbackQuery.data;

  let userInfo = await Database.getUser(userId);
  if (!userInfo) {
    return
  }

  if (data?.startsWith('setReminder-')) {
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: userId, message_id: callbackQuery.message?.message_id });
    const reminderCount = Number(data.split('-')[1] || 0);
    coach.createReminders(userId, userInfo.name, reminderCount);
  }
}

functions.http('entrypoint', async (req, res) => {
  if (req.headers['content-type'] !== 'application/json') {
    res.status(400).send('Invalid content type');
    return;
  }
  if (
    req.headers['x-telegram-bot-api-secret-token'] !==
    process.env.TELEGRAM_SECRET_HEADER
  ) {
    res.status(403).send('Invalid secret token');
    return;
  }
  if (req.body.message)
    await handleMessage(req.body.message);
  if (req.body.callback_query)
    await handleCallback(req.body.callback_query);

  res.send(`OK`);
})

if (isLocal == true) {
  bot.on('text', handleMessage);
  bot.on('callback_query', handleCallback);
  console.log('Started')
}