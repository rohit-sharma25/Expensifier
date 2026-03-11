# Product Requirements Document (PRD) - Expensifier

## Project Overview
**Expensifier** is a sleek, web-based personal finance tracking application. It provides users with comprehensive tools for expense logging, investment tracking, gamification (XP and levels), and proactive AI-driven financial insights. The application is designed to be local-first with optional Firebase cloud synchronization.

## Tech Stack
- **Frontend**: HTML5, Vanilla CSS, Vanilla JavaScript (ES6 Modules)
- **Backend/Storage**: Firebase (Authentication, Database) for synced users; `localStorage` for offline/guest mode.
- **AI Integration**: Groq API (Llama models) for smart financial insights and an integrated chat assistant.
- **Data Visualization**: Chart.js

## Core Project Structure
The application is organized into modular files to separate concerns:

### Pages
- **`index.html`**: Main Dashboard showing high-level summaries, AI risk scores, and gamification progress.
- **`expense.html`**: The primary hub for managing Expenses & Incomes. Includes manual entry forms, budget settings, a comprehensive data table, and spending breakdown charts.
- **`invest.html`**: Portfolio and investment management (handling SIPs, FDs, Stocks, etc.).
- **`profile.html`**: User settings and gamification details.

### JavaScript Modules (`js/` directory)
- **`auth-service.js`**: Handles Firebase Authentication and local guest mode sessions.
- **`db-service.js`**: Abstraction layer for data persistence (routing data to Firebase or `localStorage`).
- **`ai-service.js`**: Manages the Groq AI integration, analyzing the user's financial state to generate actionable insights and powering the floating AI chat popup.
- **`financial-engine.js`**: The core logic engine that calculates budgets, evaluates risk scores, and profiles spending behaviors.
- **`bank-sync-service.js`** / **`transaction-mapper.js`**: Previously used for direct bank API syncing.

---

## Current Objective: Bank SMS Parsing Feature
**Goal**: We are pivoting from a direct bank API connection to a simpler, more robust **Manual Bank SMS Parsing** feature. Users will copy and paste their bank transaction SMS notifications directly into the app, and the system will automatically extract the relevant details to auto-fill the expense entry form.

### Feature Requirements:
1. **Input Interface**: 
   - Introduce a new "Magic SMS Paste" section (a text area) in `expense.html`, replacing or augmenting the existing Bank Auto-Sync card.
   - Include a "Process" button to trigger the parsing.

2. **Extraction Logic (`sms-parser.js`)**: 
   - Create a robust parsing utility using Regex patterns (and potentially AI as a fallback).
   - **Extract Amount**: Identify currency symbols (Rs., INR) and numeric values.
   - **Extract Transaction Type**: Determine if the transaction is a Debit (expense) or Credit (income) based on keywords (debited, credited, spent, received).
   - **Extract Merchant/Description**: Identify the recipient or vendor name.
   - **Extract Date**: Parse dates if they exist in the SMS; otherwise, default to the current date.

3. **Data Mapping & UI Integration**: 
   - Upon successful parsing, the extracted data should automatically populate the corresponding fields in the main expense form (`#expense-desc`, `#expense-amount`, `#expense-date`).
   - Allow the user to manually verify the extracted details, select the appropriate Category and Sub-category, and then submit the final entry.

4. **Target Compatibility**: 
   - The parser should primarily target standard Indian bank and UPI notification formats (e.g., HDFC, ICICI, SBI, Axis, PhonePe, Google Pay).

### User Workflow:
1. User receives a transaction notification SMS on their phone/device.
2. User copies the SMS text and pastes it into the "Magic SMS Paste" field in the Expensifier app.
3. App parses the text and fills out the "Add New Entry" form.
4. User reviews the data, selects a category, and clicks "Add Entry" to save it to their records.
