# Waland WhatsApp M2M Dashboard

A minimalistic, mobile-responsive, light-themed Node.js dashboard wrapper for the **Waland WhatsApp M2M API**.

This application acts as your self-hosted management console to register accounts, fetch active organization contexts, generate M2M API Keys, create/link WhatsApp sessions, and monitor message delivery logs.

## 🚀 Features

- **Onboarding Assistant**: Guides you through signing up/logging in, selecting an active organization, and generating an API key automatically.
- **WhatsApp Client Manager**: Create, start, stop, and delete WhatsApp sessions in real-time.
- **Auto-polling QR code**: When starting a session, the dashboard dynamically monitors client status and displays the WhatsApp connection QR code instantly without page reloads.
- **M2M Message Dispatcher**: Interface to send message payloads (text and media attachments) directly to WhatsApp chats.
- **Delivery Logging**: Keeps local histories of successfully dispatched and failed messages in a SQLite database.
- **Responsive Layout**: Powered by Bootstrap 5 and custom styled with a clean WhatsApp brand aesthetic (`#128c7e` / `#00a884`).

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, Axios
- **Database**: SQLite3
- **Frontend**: EJS, HTML5, Vanilla JavaScript, Bootstrap 5.3, FontAwesome 6

## 📦 Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/interspeeddigitalsolutions/waland-dashboard.git
   cd waland-dashboard
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Settings**:
   Copy the example config file and customize your port or base URL if needed:
   ```bash
   cp config.example.json config.json
   ```

4. **Start the application**:
   ```bash
   npm start
   ```
   Open `http://localhost:3000` (or your configured port) in your web browser.

## 🔒 Security Note

Your API Keys, session tokens, and local message logs are persisted locally in `config.json` and `waland.db`. These files are included in the `.gitignore` to prevent committing private credentials to public code repositories.
