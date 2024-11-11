import { GenerateContentResult, GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai";
import { CloudTasksClient } from "@google-cloud/tasks";
import EventEmitter from 'node:events';
import { Database } from "./database.js";
import { GDoc } from "./gdocs.js";
import { retry } from "./utils.js";


if (!process.env.GOOGLE_GEN_AI_KEY) {
  throw new Error('GOOGLE_GEN_AI_KEY is not defined');
}
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEN_AI_KEY);

const jsonModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash-002",
  generationConfig: { temperature: 2, responseMimeType: "application/json" },
});

const taskClient = new CloudTasksClient();

interface BasicResponse {
  id?: string;
  to: string;
  type: string;
  answers?:
  {
    text: string;
    id: string;
  }[]
}
interface ResponseText extends BasicResponse {
  type: 'text';
  text: string;
}
interface ResponseVideo extends BasicResponse {
  type: 'video';
  url: string;
  width: number;
  height: number;
}
interface ResponseFile extends BasicResponse {
  type: 'file';
  path: string;
}

export type Response = ResponseText | ResponseVideo | ResponseFile;

export class Coach extends EventEmitter {
  model: GenerativeModel;
  role: string;
  constructor({ name, role }: { name: string; role: string }) {
    super();
    this.model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-002",
      generationConfig: { temperature: 2 },
      systemInstruction: role + ' If the user talk about something not related to IVF ask him to stay focused on the IVF process in a positive way.',
    });
    this.role = role;
  }

  async chat(userId: string, message: string): Promise<void> {
    const history = await Database.getChatHistory(userId);

    const chat = this.model.startChat({
      history: history,
    })
    try {
      const text = await retry<GenerateContentResult>(() => chat.sendMessage(message), 3, 5000).then(async (chat) => {
        return chat.response.text()
      })

      await Database.setChatHistory(userId, 'chat', { history: await chat.getHistory() });
      this.emit('message', {
        to: userId,
        type: 'text',
        text,
      });
    } catch (e) {
      console.error('GenAI error:', e);
      this.emit('message', {
        to: userId,
        type: 'text',
        text: 'Sorry, I am having trouble to chat right now. Please try again later.',
      });
      return;
    }
  }

  async sayHello(userId: string): Promise<void> {
    this.emit('message', {
      to: userId,
      type: 'video',
      url: 'https://storage.googleapis.com/ivf-coach-videos/intro-v2.mp4',
      width: 720,
      height: 1280,
    });
    this.emit('message', {
      to: userId,
      type: 'text',
      text: `Let’s start with something simple:\n✨ What’s your name?`,
    });
  }

  private async createReminder(topic: string, name: string, count: number): Promise<string[]> {
    const prompt = `Create ${count} motivational message for one of your clients named ${name}, that keeps them in good spirits during their IVF process. It could just be some kind words, some words of empathy, just anything to let them know to not give up and keep going, and keep staying positive.\n Then wish them a great rest of the day.
Return: {'messages': string[]}`;
    try {
      const res = await retry<GenerateContentResult>(() =>
        jsonModel.generateContent({
          systemInstruction: this.role,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }), 3, 5000)
      return JSON.parse(res.response.text()).messages;
    } catch (e) {
      console.error('GenAI error:', e);
      return [];
    }
  }

  async createReminders(userId: string, userName: string, reminderCount: number): Promise<void> {
    const reminders = await Database.getReminders(userId);
    this.emit('message', {
      to: userId,
      type: 'text',
      text: `Great choice! You’ll receive ${reminderCount} reminders each day, spaced out to give you a steady stream of encouragement. And you can also text me at any time if you need some good vibes or just want to talk.`,
    });
    await Promise.all(reminders.map(async reminder => {
      try {
        await taskClient.deleteTask({
          name: taskClient.taskPath('wtm-hackathon-ivf-coach', 'us-central1', 'reminder-queue', reminder.id),
        })
      } catch (e) {
        console.warn(e);
      }
      await Database.deleteReminder(userId, reminder.id);
    }));

    this.emit('message', {
      to: userId,
      type: 'text',
      text: `For the best experience, be sure to enable notifications on your phone, so you don’t miss any of the support I’ll be sending your way.`,
    });
    // Create reminders for the week
    const messages = await this.createReminder('IVF', userName, 7 * reminderCount);

    for (let i = 0; i < 7; i++) {
      const day = new Date();
      // day.setUTCDate(day.getDate() + i + 1);
      day.setUTCHours(day.getUTCHours() + i + 1);
      for (let j = 0; j < reminderCount; j++) {
        const message = messages[j + i * reminderCount];
        // add timezone offset UTC-4
        // day.setUTCHours(day.getUTCHours() + 4);
        day.setUTCMinutes(j * 20);
        day.setUTCSeconds(0);
        day.setUTCMilliseconds(0);
        try {
          const id = `reminder-${userId}-${j + i * reminderCount}-${Math.random().toString(36).substring(2, 15)}`;
          Database.setReminder(userId, id, {
            id,
            date: day,
            text: message,
          });
          console.log("🚧 Creating job");
          await this.scheduleReminders(userId, day, id, message);
          console.log("✅ Reminder created");
        } catch (e) {
          console.warn(e);
        }
      }
    }
    this.emit('message', {
      to: userId,
      type: 'text',
      text: `Looking forward to walking with you through this journey! 🌸`,
    });
  }

  async askQuestionForMorningJournal(userId: string, message?: string) {
    const initialPrompt = this.role + `\nToday we want to do a morning gratitude journal exercise with the client. For this exercise, the client should complete the following 4 sentences:
1. Today I am feeling…
2. Today I am going to… (what are you going to do for your mental health)
3. Today I am looking forward to…
4. My affirmation today…
You want to gather the information step by step, one question at a time. If the client struggles to provide clear answers, you want to help him/her with supporting questions. For example, if the client can not come up with an affirmation, you want to provide them with examples they can choose from. But you should keep focus on answering thoses sentences. This sentences should be positive other wise you should ask the client to rephrase them.
Return: {'newMessageForUser': string, 'isDone': boolean, 'sentences': string[]}`;
    const history = await Database.getChatHistory(userId, 'morning-journal');
    if (!message) {
      const chat = await jsonModel.startChat()
      const res = await retry<GenerateContentResult>(() =>
        chat.sendMessage(initialPrompt), 3, 5000)
      const { newMessageForUser } = JSON.parse(res.response.text());
      await Database.setChatHistory(userId, 'morning-journal', { history: await chat.getHistory() });
      this.emit('message', {
        to: userId,
        type: 'text',
        text: newMessageForUser,
      });
    } else {
      const chat = jsonModel.startChat({
        history: history,
      })
      const res = await chat.sendMessage(message);
      const { newMessageForUser, isDone, sentences } = JSON.parse(res.response.text());
      await Database.setChatHistory(userId, 'morning-journal', { history: await chat.getHistory() });
      this.emit('message', {
        to: userId,
        type: 'text',
        text: newMessageForUser,
      });
      if (isDone) {
        const path = await this.createMorningPdf(sentences);
        this.emit('message', {
          to: userId,
          type: 'text',
          text: `Great! Here is your PDF`,
        });
        this.emit('message', {
          to: userId,
          type: 'file',
          path,
        });
        return true
      }
    }
    return false
  }

  async createMorningPdf(sentences: string[]): Promise<string> {
    const doc = await GDoc.create('1mk-4rlEErbtZpWkILsdrO1EBPSZv925T21PGn6IujcA')
    await doc.setText('daily_feeling', sentences[0])
    await doc.setText('daily_action_item', sentences[1])
    await doc.setText('daily_looking_forward_to', sentences[2])
    await doc.setText('daily_affirmation', sentences[3])
    const filename = `morning-journal-${Math.random()}.pdf`
    await doc.export(filename);
    return './' + filename
  }

  private async scheduleReminders(userId: string, date: Date, id: string, text: string) {
    await taskClient.createTask({
      parent: taskClient.queuePath('wtm-hackathon-ivf-coach', 'us-central1', 'reminder-queue'),
      task: {
        name: taskClient.taskPath('wtm-hackathon-ivf-coach', 'us-central1', 'reminder-queue', id),
        scheduleTime: {
          seconds: Math.floor(date.getTime() / 1000),
        },
        httpRequest: {
          url: `https://api.telegram.org/bot${process.env.TELEGRAM_SECRET}/sendMessage`,
          httpMethod: 'POST',
          body: Buffer.from(JSON.stringify({
            chat_id: userId,
            text: text,
          })),
          headers: {
            'Content-Type': 'application/json',
          },
        },
      }
    });
  }
}