import { GoogleAuth } from 'google-auth-library';
import { docs, docs_v1 } from '@googleapis/docs'
import { drive, drive_v3 } from '@googleapis/drive'
import fs from 'node:fs';

export class GDoc {
  docsClient: docs_v1.Docs;
  driveClient: drive_v3.Drive;
  docId: string | undefined;
  constructor() {
    const serviceAccountAuth = new GoogleAuth({
      scopes: [
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/drive',
      ],
    });
    this.docsClient = docs({ version: 'v1', auth: serviceAccountAuth });
    this.driveClient = drive({ version: 'v3', auth: serviceAccountAuth });
  }
  async init(templateId: string) {
    this.docId = await this.copyDocument(templateId);
  }
  static async create(templateId: string) {
    const doc = new GDoc();
    await doc.init(templateId)
    return doc;
  }
  private async copyDocument(templateId: string) {
    try {
      const response = await this.driveClient.files.copy({
        fileId: templateId,
        requestBody: {
          name: 'Your Template', // Set a new name for the copied document
        },
      });
      if (!response.data.id) {
        throw new Error('Document ID not found');
      }
      return response.data.id; // Return the new document's ID
    } catch (error) {
      console.error('Error copying document:', error);
      throw error;
    }
  }
  private async shareDocument(emailAddress: string) {
    try {
      await this.driveClient.permissions.create({
        fileId: this.docId,
        requestBody: {
          role: 'writer',
          type: 'user',
          emailAddress: emailAddress,
        },
      });
    } catch (error) {
      console.error('Error granting permission:', error);
      throw error;
    }
  }

  async export(outputPath: string) {

    try {
      // Export the document as a PDF
      const response = await this.driveClient.files.export(
        {
          fileId: this.docId,
          mimeType: 'application/pdf',
        },
        { responseType: 'stream' }
      );

      // Pipe the PDF stream to a file
      await new Promise((resolve, reject) => {
        const dest = fs.createWriteStream(outputPath);
        response.data
          .on('end', () => {
            resolve(outputPath);
          })
          .on('error', (error: Error) => {
            console.error('Error exporting document:', error);
            reject(error);
          })
          .pipe(dest);
      });
    } catch (error) {
      console.error('Error during export:', error);
      throw error;
    }
  }

  setText = async (key: string, value: string) => {
    try {
      // Define the findReplace request
      const requests = [
        {
          replaceAllText: {
            containsText: {
              text: `\{${key}\}`,  // Text to find
              matchCase: true,
            },
            replaceText: value,  // Text to replace with
          },
        },
      ];

      // Execute the batchUpdate request
      const result = await this.docsClient.documents.batchUpdate({
        documentId: this.docId,
        requestBody: {
          requests: requests
        },
      });
      if (result.data.replies?.[0]?.replaceAllText?.occurrencesChanged != 1) {
        throw new Error('Text not found');
      }
    } catch (error) {
      console.error('Error replacing text:', error);
    }
  }
};
