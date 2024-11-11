import { Firestore } from '@google-cloud/firestore';
import { Content } from '@google/generative-ai';

const firestore = new Firestore({
  databaseId: '(default)',
});

export class Database {
  static async createUser(userId: string, name: string) {
    await firestore.doc(`Users/${userId}`).set({
      id: userId,
      name: name,
      step: 0,
      createdAt: new Date(),
    });
  }

  static async getUser(userId: string) {
    const userRef = await firestore.doc(`Users/${userId}`).get();
    if (!userRef.exists) {
      return null;
    }
    return userRef.data();
  }

  static async updateUser(userId: string, data: any) {
    await firestore.doc(`Users/${userId}`).update(data);
  }
  static async getChatHistory(userId: string, chatName: string = 'chat') {
    const doc = await firestore.doc(`UsersChatHistory/${userId}-${chatName}`).get();
    const { history } = doc.exists ? doc.data() as { history: Content[] } : { history: [] };
    return history
  }
  static async setChatHistory(userId: string, chatName: string = 'chat', data: any) {
    await firestore.doc(`UsersChatHistory/${userId}-${chatName}`).set(data);
  }
  static async getReminders(userId: string) {
    const re = await firestore.collection(`Users/${userId}/Reminders`).get();
    return re.docs.map(doc => doc.data());
  }
  static async setReminder(userId: string, reminderId: string, data: any) {
    await firestore.doc(`Users/${userId}/Reminders/${reminderId}`).set(data);
  }
  static async deleteReminder(userId: string, reminderId: string) {
    await firestore.doc(`Users/${userId}/Reminders/${reminderId}`).delete();
  }
}