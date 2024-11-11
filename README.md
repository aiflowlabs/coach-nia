# Coach Nia is a Telegram bot that offers daily support and encouragement

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Dependencies](#dependencies)
- [Next steps](#next-steps)

## Introduction

Coach Nia is a Telegram bot that offers daily support and encouragement, this
bot is designed to help women undergoing IVF and infertility treatments. This
bot is hosted as a serverless function on GCP Cloud Run Function. It developed
in TypeScript and uses the
[node-telegram-bot-api](https://www.npmjs.com/package/node-telegram-bot-api)
library to interact with the Telegram Bot API.

The bot is designed to send daily messages to users. The messages are designed
to be supportive and encouraging, and to help users feel less alone during their
treatment.

## Features

- Daily messages: The bot sends a daily message to users, offering support and
  encouragement.
- Chat: Users can chat with the bot to receive additional support and
  encouragement as needed. This chat is always available, and the bot will
  respond to messages in real time using Gemini API.
- PDF: The bot create custom PDFs for users, using Gemini API and Google Docs
  API. The PDFs contain information about the user's plan, as well as tips and
  advice for managing the emotional and physical challenges.
- Video: The bot can send video messages to users, offering additional support
  and encouragement. The videos are AI generated and are designed to be
  uplifting and inspiring.

## Dependencies

- Telegram:
  [node-telegram-bot-api](https://www.npmjs.com/package/node-telegram-bot-api)
- Gemini API: [gemini](https://www.npmjs.com/package/@google/generative-ai)
- Google Docs API:
  [googleapis-docs](https://www.npmjs.com/package/@googleapis/docs)
- Google Cloud Tasks:
  [google-cloud-tasks](https://www.npmjs.com/package/@google-cloud/tasks)

## Next steps

- Add more features: The bot could be expanded to offer additional features,
  such as a calendar to help users track their treatment progress, or a forum
  where users can connect with others going through similar experiences.
- Improve the chat: The bot could be improved to offer more personalized support
  and encouragement, using AI to analyze users' messages and respond in a more
  tailored way.
- Expand to other platforms: The bot could be expanded to other platforms, such
  as Facebook Messenger or WhatsApp, to reach more users and offer support to a
  wider audience.
