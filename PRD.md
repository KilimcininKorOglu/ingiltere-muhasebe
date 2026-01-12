# Product Requirements Document (PRD)
## UK Pre-Accounting Application for Turkish Entrepreneurs

**Version:** 1.2
**Date:** 2026-01-12
**Status:** Approved for Development
**Naming Convention:** camelCase for all database fields and API properties

---

## 1. Executive Summary

This document outlines the requirements for a web-based pre-accounting application designed for Turkish entrepreneurs operating companies in the United Kingdom. The application will provide essential accounting functionalities while ensuring 100% compliance with UK tax legislation, including VAT, Corporation Tax, Self Assessment, and PAYE regulations.

**Core Philosophy:** Empower users to manage their business finances and tax obligations **without requiring an accountant**, through intelligent automation, comprehensive guidance, and built-in compliance checks.

The solution will feature a modern, user-friendly interface with bilingual support (Turkish and English), enabling users to manage income, expenses, invoicing, bank reconciliation, and tax reporting efficiently. The system includes extensive in-app guidance, tutorials, and explanations to educate users at every step.

---

## 2. Project Overview

### 2.1 Background

Turkish entrepreneurs establishing businesses in the UK often face challenges navigating the UK tax system and maintaining compliant accounting records. This application aims to simplify pre-accounting tasks, reduce errors, and ensure compliance with HMRC (Her Majesty's Revenue and Customs) requirements.

### 2.2 Objectives

- **Eliminate accountant dependency** for small businesses through intelligent automation and education
- Provide a comprehensive pre-accounting solution for UK-based Turkish businesses
- Ensure 100% compliance with UK tax legislation through built-in validation and rules
- Offer bilingual support (Turkish and English) with contextual help and tutorials
- Enable efficient tracking of income, expenses, invoicing, and VAT with guided workflows
- Generate tax-ready reports for HMRC submissions with step-by-step filing instructions
- Deliver a modern, intuitive user experience with maximum user guidance at every step
- Reduce accounting costs by 90%+ for small businesses and sole traders

### 2.3 Target Audience

- **Primary:** Turkish entrepreneurs and small business owners operating in the UK
- **Secondary:** Self-employed individuals and sole traders requiring basic accounting capabilities

### 2.4 Success Metrics

- **80%+ of users successfully file taxes without accountant support**
- User satisfaction score above 4.5/5
- 100% accuracy in tax calculations per UK regulations
- Zero HMRC penalties due to calculation errors
- 90%+ reduction in accounting costs for users
- Time savings of at least 70% compared to manual methods
- Average user completes onboarding and understands basic features within 30 minutes

---

## 3. Technical Architecture

### 3.1 Technology Stack

| Component  | Technology        | Rationale                                           |
|------------|-------------------|-----------------------------------------------------|
| Frontend   | React             | Modern, component-based UI framework                |
| Backend    | Node.js + Express | JavaScript full-stack development, high performance |
| Database   | SQLite            | Lightweight, serverless, zero-configuration         |
| Language   | i18n (TR/EN)      | Bilingual support for Turkish and English users     |
| Deployment | Web Application   | Browser-based access, no installation required      |

### 3.2 Architecture Overview

```
┌─────────────────────────────────────────────────┐
│               Frontend (React)                   │
│  - Modern UI/UX                                 │
│  - i18n Support (TR/EN)                         │
│  - Responsive Design                            │
└─────────────────┬───────────────────────────────┘
                  │
                  │ REST API
                  │
┌─────────────────▼───────────────────────────────┐
│          Backend (Node.js/Express)              │
│  - RESTful API                                  │
│  - Business Logic                               │
│  - Tax Calculations                             │
│  - UK Compliance Rules                          │
└─────────────────┬───────────────────────────────┘
                  │
                  │ ORM/Query Layer
                  │
┌─────────────────▼───────────────────────────────┐
│            Database (SQLite)                    │
│  - Transactions                                 │
│  - Invoices                                     │
│  - Customers/Suppliers                          │
│  - Tax Records                                  │
└─────────────────────────────────────────────────┘
```

### 3.3 Key Architectural Principles

- **Separation of Concerns:** Frontend and backend are completely decoupled
- **RESTful API Design:** Stateless, resource-based endpoints
- **Data Integrity:** Database constraints and validation at both frontend and backend
- **Localization:** i18n framework for seamless language switching
- **Security:** Input validation, authentication, and authorization
- **Compliance:** Built-in UK tax rules and validation logic

---

## 4. Functional Requirements

### 4.1 Core Features

#### 4.1.1 Income and Expense Tracking

**Description:** Record and categorize all business income and expenses according to UK accounting standards.

**Requirements:**

- Create income transactions with:
  - Date
  - Amount (GBP)
  - Category (pre-defined UK chart of accounts)
  - Description
  - VAT rate and amount
  - Customer reference (optional)
  - Payment method
  - Receipt/invoice attachment (optional)

- Create expense transactions with:
  - Date
  - Amount (GBP)
  - Category (pre-defined UK chart of accounts)
  - Description
  - VAT rate and amount
  - Supplier reference (optional)
  - Payment method
  - Receipt attachment (optional)

- **UK Chart of Accounts** (pre-defined categories):
  - **Income:** Sales, Services, Interest, Other Income
  - **Expenses:** Cost of Goods Sold, Office Expenses, Travel & Subsistence, Professional Fees, Bank Charges, Insurance, Depreciation, Rent, Utilities, Marketing, Salaries & Wages, Pension Contributions, National Insurance
  - **Assets:** Cash, Bank Accounts, Fixed Assets
  - **Liabilities:** VAT Liability, Creditors, Loans
  - **Equity:** Capital, Retained Earnings

- Transaction listing with filters:
  - Date range
  - Category
  - Type (income/expense)
  - Search by description

- Edit and delete transactions
- Transaction history and audit trail

**User Stories:**

- As a business owner, I want to record my daily sales so that I can track my income.
- As a business owner, I want to categorize my expenses so that I can prepare accurate tax returns.
- As a business owner, I want to see all transactions in a specific period so that I can review my cash flow.

---

#### 4.1.2 Invoice Management

**Description:** Create, manage, and track invoices for customers in compliance with UK invoicing requirements.

**Requirements:**

- **Invoice Creation:**
  - Invoice number (auto-generated or manual)
  - Invoice date
  - Due date
  - Customer details (name, address, VAT number)
  - Line items:
    - Description
    - Quantity
    - Unit price
    - VAT rate (0%, 5%, 20%)
    - Total
  - Subtotal, VAT breakdown, Total
  - Payment terms
  - Notes/terms and conditions
  - Currency: GBP

- **UK Invoice Compliance:**
  - Must include seller's VAT number (if VAT registered)
  - Must include customer's VAT number (for B2B)
  - Sequential invoice numbering
  - Tax point (date of supply)

- **Invoice Status:**
  - Draft
  - Sent
  - Paid
  - Overdue
  - Cancelled

- Invoice listing with filters:
  - Date range
  - Customer
  - Status
  - Search

- Export invoice as PDF
- Email invoice (future enhancement)
- Mark invoice as paid
- Track payments against invoices

**User Stories:**

- As a business owner, I want to create professional invoices so that I can bill my customers.
- As a business owner, I want to track unpaid invoices so that I can manage my cash flow.
- As a business owner, I want to export invoices as PDF so that I can send them to customers.

---

#### 4.1.3 VAT Calculation and Reporting

**Description:** Calculate VAT obligations and generate VAT return reports in compliance with UK VAT regulations.

**Requirements:**

- **VAT Rates:**
  - Standard Rate: 20%
  - Reduced Rate: 5%
  - Zero Rate: 0%
  - Exempt

- **VAT Tracking:**
  - Track VAT on sales (output VAT)
  - Track VAT on purchases (input VAT)
  - Calculate net VAT liability (output VAT - input VAT)

- **VAT Return (Quarterly):**
  - VAT return period selection (start and end date)
  - Box 1: VAT due on sales
  - Box 2: VAT due on EC acquisitions
  - Box 3: Total VAT due (Box 1 + Box 2)
  - Box 4: VAT reclaimed on purchases
  - Box 5: Net VAT to pay/reclaim (Box 3 - Box 4)
  - Box 6: Total value of sales excluding VAT
  - Box 7: Total value of purchases excluding VAT
  - Box 8: Total value of EC supplies excluding VAT
  - Box 9: Total value of EC acquisitions excluding VAT

- **VAT Report:**
  - Generate VAT return summary for manual submission to HMRC
  - Export as PDF
  - Transaction breakdown for each box

- **VAT Registration:**
  - User can set VAT registration status
  - If not VAT registered, VAT features are disabled

**User Stories:**

- As a VAT-registered business owner, I want to calculate my VAT liability so that I can submit accurate returns to HMRC.
- As a business owner, I want to see a breakdown of my VAT transactions so that I can verify my calculations.
- As a business owner, I want to export my VAT return as PDF so that I can file it manually with HMRC.

---

#### 4.1.4 Bank Reconciliation

**Description:** Match bank transactions with recorded income and expenses to ensure accuracy.

**Requirements:**

- **Bank Account Management:**
  - Add multiple bank accounts
  - Bank account details (name, account number, sort code, opening balance)

- **Bank Transaction Import:**
  - Manual entry of bank transactions
  - CSV import (future enhancement)

- **Reconciliation:**
  - View unreconciled transactions
  - Match bank transactions with recorded income/expense transactions
  - Mark transactions as reconciled
  - Show reconciliation status
  - Calculate reconciled vs unreconciled balance

- **Bank Statement:**
  - View bank statement with reconciliation status
  - Filter by date range
  - Export reconciliation report

**User Stories:**

- As a business owner, I want to reconcile my bank transactions so that I can ensure my records are accurate.
- As a business owner, I want to see which transactions are unreconciled so that I can identify discrepancies.
- As a business owner, I want to add multiple bank accounts so that I can manage all my business finances.

---

#### 4.1.5 Customer and Supplier Management

**Description:** Maintain a database of customers and suppliers for invoicing and expense tracking.

**Requirements:**

- **Customer Records:**
  - Customer name
  - Contact person
  - Email
  - Phone
  - Address (billing and shipping)
  - VAT number
  - Payment terms
  - Notes

- **Supplier Records:**
  - Supplier name
  - Contact person
  - Email
  - Phone
  - Address
  - VAT number
  - Payment terms
  - Notes

- Customer/supplier listing with search and filters
- Link customers to invoices
- Link suppliers to expenses
- Customer/supplier transaction history
- Edit and delete records

**User Stories:**

- As a business owner, I want to maintain a customer database so that I can quickly create invoices.
- As a business owner, I want to track supplier information so that I can manage my expenses.
- As a business owner, I want to see transaction history per customer so that I can manage relationships.

---

### 4.2 Reporting and Analytics

#### 4.2.1 Financial Reports

**Requirements:**

- **Profit & Loss Statement:**
  - Income by category
  - Expenses by category
  - Net profit/loss
  - Date range filter
  - Export as PDF/CSV

- **Balance Sheet:**
  - Assets
  - Liabilities
  - Equity
  - At a specific date
  - Export as PDF/CSV

- **Cash Flow Statement:**
  - Opening balance
  - Cash inflows (income)
  - Cash outflows (expenses)
  - Closing balance
  - Date range filter
  - Export as PDF/CSV

- **VAT Summary Report:**
  - VAT collected
  - VAT paid
  - Net VAT liability
  - By period
  - Export as PDF/CSV

#### 4.2.2 Tax Reports

**Requirements:**

- **VAT Return Report:** (Covered in 4.1.3)

- **Corporation Tax Estimate:**
  - Calculate estimated Corporation Tax liability
  - Based on annual profit
  - Current Corporation Tax rate (19% for 2024/25, or 25% for profits over £250,000)
  - Small Profits Rate for profits under £50,000 (19%)
  - Marginal Relief for profits between £50,000 and £250,000

- **Self Assessment Summary:**
  - For sole traders and partners
  - Income summary
  - Allowable expenses
  - Estimated Income Tax and National Insurance
  - Class 2 and Class 4 NI contributions

- **PAYE/Payroll Summary:**
  - Employee salary records
  - PAYE deductions
  - National Insurance deductions (employer and employee)
  - Pension contributions
  - Monthly/annual summary
  - P60/P45 data (future enhancement)

**User Stories:**

- As a business owner, I want to see my estimated Corporation Tax so that I can plan my finances.
- As a sole trader, I want to see my Self Assessment summary so that I can prepare my tax return.
- As an employer, I want to track PAYE and NI deductions so that I can submit accurate reports to HMRC.

---

### 4.3 User Management

**Requirements:**

- **Authentication:**
  - User registration
  - Login with email and password
  - Logout
  - Password reset (future enhancement)

- **User Profile:**
  - User name
  - Email
  - Business name
  - Business address
  - VAT registration number
  - VAT registration status (Yes/No)
  - Company registration number
  - Tax year settings (UK tax year: 6 April to 5 April)
  - Preferred language (Turkish/English)

- **Single User Model:**
  - One user per account
  - No multi-user or role-based access control in version 1

**User Stories:**

- As a business owner, I want to register an account so that I can use the application.
- As a business owner, I want to set my VAT registration status so that the application can calculate my VAT correctly.
- As a business owner, I want to change my preferred language so that I can use the app in Turkish or English.

---

### 4.4 Localization (i18n)

**Requirements:**

- **Language Support:**
  - Turkish (TR)
  - English (EN-GB)

- **Localized Elements:**
  - All UI text, labels, buttons, and messages
  - Date formats (DD/MM/YYYY for UK)
  - Number formats (1,234.56 for UK)
  - Currency symbol (£)
  - Tax terminology (e.g., "KDV" in Turkish, "VAT" in English)

- **Language Switching:**
  - User can switch language from settings
  - Language preference is saved
  - Default language based on browser settings (fallback: English)

**User Stories:**

- As a Turkish speaker, I want to use the application in Turkish so that I can understand all features.
- As a bilingual user, I want to switch between Turkish and English so that I can use my preferred language.

---

### 4.5 User Guidance and Education System

**Description:** Comprehensive help and guidance system to enable users to manage their accounting and taxes without professional assistance.

**Requirements:**

#### 4.5.1 Interactive Onboarding

- **First-Time User Wizard:**
  - Step-by-step setup guide after registration
  - Business type selection (Sole Trader, Limited Company, Partnership)
  - VAT registration status
  - Tax year configuration
  - Chart of accounts explanation
  - Interactive tour of key features

- **Progress Tracking:**
  - Onboarding checklist showing completion status
  - "Getting Started" dashboard for new users
  - Achievement badges for completing key tasks

#### 4.5.2 Contextual Help System

- **Tooltips and Popovers:**
  - Hover tooltips on all form fields explaining what to enter
  - "What is this?" icons next to technical terms
  - Example values shown in placeholders
  - Visual indicators for required vs optional fields

- **In-App Documentation:**
  - Help panel accessible from every page
  - Context-aware help content based on current page
  - Searchable knowledge base
  - Quick links to relevant HMRC guidance

- **Video Tutorials:**
  - Embedded video guides for key features:
    - "How to record your first transaction"
    - "Creating a VAT-compliant invoice"
    - "Understanding your VAT return"
    - "Preparing for Self Assessment"
  - Short (2-3 minute) focused tutorials
  - Both Turkish and English versions

#### 4.5.3 Smart Validation and Warnings

- **Real-Time Validation:**
  - Inline error messages with clear explanations
  - Warning messages for unusual entries (e.g., "This expense seems high, are you sure?")
  - VAT rate validation based on category
  - Sequential invoice number checking

- **Compliance Warnings:**
  - Alert when approaching VAT registration threshold (£85k)
  - Reminder when VAT return deadline approaching
  - Warning if Corporation Tax payment due soon
  - Notification if missing required information

- **Smart Suggestions:**
  - Suggest category based on transaction description
  - Recommend correct VAT rate based on product/service
  - Duplicate transaction detection
  - Unusual pattern detection (e.g., "You haven't recorded any expenses this month")

#### 4.5.4 Guided Workflows

- **Step-by-Step Processes:**
  - Invoice creation wizard
  - VAT return preparation guide
  - End-of-year closing checklist
  - Bank reconciliation assistant

- **Pre-Flight Checks:**
  - Before submitting VAT return: "Have you checked all transactions?"
  - Before finalizing accounts: "Have you reconciled all bank accounts?"
  - Validation summary with clickable issues

#### 4.5.5 Educational Content

- **UK Tax Basics Section:**
  - "Understanding VAT in the UK"
  - "Corporation Tax explained for Turkish entrepreneurs"
  - "Self Assessment guide for sole traders"
  - "PAYE and National Insurance basics"
  - "Allowable expenses in the UK"
  - "VAT invoice requirements"

- **Glossary:**
  - Bilingual glossary of UK tax terms
  - Examples for each term
  - Links to HMRC official definitions

- **FAQ Section:**
  - Common questions categorized by topic
  - Answers in plain language
  - Regular updates based on user queries

#### 4.5.6 Filing Instructions

- **HMRC Submission Guides:**
  - Step-by-step guide for manual VAT return filing on HMRC portal
  - Screenshots of HMRC portal with annotations
  - Corporation Tax filing instructions (CT600)
  - Self Assessment filing guide
  - Where to find your UTR, VAT number, etc.

- **Checklist Before Filing:**
  - "Have you double-checked all figures?"
  - "Have you saved a copy of your return?"
  - "Do you have funds ready for tax payment?"

#### 4.5.7 Support Resources

- **Community Forum:** (Future enhancement)
  - User community for peer support
  - Turkish-speaking community section

- **Contact Support:**
  - In-app support ticket system
  - Email support with 24-hour response time
  - FAQ before contacting support

- **Accountant Referral:** (Optional)
  - List of UK accountants familiar with Turkish entrepreneurs
  - When to consider professional help:
    - Complex international transactions
    - First-year setup assistance
    - R&D tax credits
    - Company restructuring

**User Stories:**

- As a first-time user, I want a guided onboarding so that I can set up my account correctly.
- As a business owner with no accounting knowledge, I want tooltips on every field so that I understand what to enter.
- As a VAT-registered business, I want step-by-step filing instructions so that I can submit my VAT return to HMRC without errors.
- As a user preparing my first tax return, I want video tutorials so that I can learn by watching.
- As a Turkish entrepreneur, I want educational content about UK tax in my language so that I can understand my obligations.

---

## 5. UK Tax Compliance Requirements

### 5.1 VAT (Value Added Tax)

**Compliance Rules:**

- **VAT Registration Threshold:** £90,000 (2024/25)
  - Application should allow users to set VAT registration status
  - If turnover exceeds threshold, display warning

- **VAT Rates:**
  - Standard: 20%
  - Reduced: 5% (domestic fuel, children's car seats, etc.)
  - Zero: 0% (most food, books, children's clothing, etc.)
  - Exempt (insurance, education, healthcare, etc.)

- **VAT Return Filing:**
  - Quarterly (standard)
  - Monthly (optional for some businesses)
  - Annual (for small businesses with turnover under £1.35m)

- **VAT Return Deadline:**
  - 1 month and 7 days after the end of the VAT period

- **VAT Invoice Requirements:**
  - Unique sequential invoice number
  - Business name and address
  - VAT registration number
  - Invoice date
  - Tax point (date of supply if different)
  - Customer name and address
  - Description of goods/services
  - Quantity and price excluding VAT
  - VAT rate and amount
  - Total amount payable including VAT

- **Reverse Charge:** (Future enhancement for B2B services from abroad)

**Implementation:**

- Pre-defined VAT rates in the system
- VAT calculation on every transaction
- VAT return report matching HMRC boxes 1-9
- Invoice template compliant with HMRC requirements
- Warning system for VAT registration threshold

---

### 5.2 Corporation Tax

**Compliance Rules:**

- **Corporation Tax Rates (2024/25):**
  - Main Rate: 25% (for profits over £250,000)
  - Small Profits Rate: 19% (for profits up to £50,000)
  - Marginal Relief: For profits between £50,000 and £250,000

- **Accounting Period:**
  - Usually 12 months
  - Financial year-end date set by company

- **Filing Deadline:**
  - 12 months after the end of the accounting period

- **Payment Deadline:**
  - 9 months and 1 day after the end of the accounting period

**Implementation:**

- Calculate estimated Corporation Tax based on profit
- Apply correct tax rate based on profit thresholds
- Display estimated tax liability
- Generate profit summary for Corporation Tax return

---

### 5.3 Self Assessment (for Sole Traders)

**Compliance Rules:**

- **Income Tax Rates (2024/25):**
  - Personal Allowance: £12,570 (tax-free)
  - Basic Rate: 20% on income between £12,571 - £50,270
  - Higher Rate: 40% on income between £50,271 - £125,140
  - Additional Rate: 45% on income over £125,140

- **National Insurance (Class 2 & Class 4):**
  - Class 2: £3.45 per week (for profits over £12,570)
  - Class 4: 9% on profits between £12,570 - £50,270
  - Class 4: 2% on profits over £50,270

- **Allowable Expenses:**
  - Office costs, travel, staff costs, stock and materials, legal and financial costs, marketing, etc.

- **Filing Deadline:**
  - 31 January following the end of the tax year (5 April)

**Implementation:**

- Calculate estimated Income Tax based on profit
- Calculate Class 2 and Class 4 National Insurance
- Generate Self Assessment summary
- List allowable expenses

---

### 5.4 PAYE and Payroll

**Compliance Rules:**

- **PAYE (Pay As You Earn):**
  - Deduct Income Tax and National Insurance from employee wages
  - Pay to HMRC monthly (or quarterly for small employers)

- **National Insurance (Employer and Employee):**
  - Employee: 12% on earnings £242 - £967 per week (2024/25)
  - Employee: 2% on earnings over £967 per week
  - Employer: 13.8% on earnings over £175 per week

- **Pension Auto-Enrolment:**
  - Minimum total contribution: 8% (employer 3%, employee 5%)

- **Reporting:**
  - Full Payment Submission (FPS) on or before payday
  - Employer Payment Summary (EPS) if applicable

**Implementation:**

- Record employee details
- Calculate gross salary, PAYE, NI (employee and employer)
- Calculate pension contributions
- Generate payroll summary for HMRC reporting
- Display monthly/annual PAYE and NI totals

---

### 5.5 Making Tax Digital (MTD)

**Status:** Planned for Phase 2 (Post-MVP)

**Phase 1 (MVP):** Manual submission workflow
- System generates complete VAT return with all 9 boxes calculated
- User receives step-by-step guide to manually enter data on HMRC portal
- System provides screenshots and instructions for each step
- All data ready to copy-paste into HMRC portal

**Phase 2 Enhancement:** Full MTD API Integration
- **OAuth 2.0 Integration:** Secure authentication with HMRC Gateway
- **Direct VAT Submission:** One-click VAT return submission to HMRC
- **Real-Time Status Updates:** Automatic retrieval of submission status
- **Obligation Management:** View VAT return obligations from HMRC
- **Payment Status Tracking:** Check payment status with HMRC

**Benefits of MTD Integration:**
- Reduces filing time from 15 minutes to 30 seconds
- Eliminates manual data entry errors
- Automatic confirmation from HMRC
- Complete audit trail of submissions

**Implementation Notes:**
- Requires HMRC Developer account and application registration
- Must pass HMRC testing and approval process
- Users must authorize app access to their HMRC account
- Full compliance with MTD regulations

---

## 6. Non-Functional Requirements

### 6.1 Performance

- Application should load within 3 seconds on standard broadband
- Database queries should return results within 1 second
- Support up to 10,000 transactions per year per user without performance degradation

### 6.2 Security

- **Authentication:** Secure login with email and password
- **Password Storage:** Hashed passwords (bcrypt or similar)
- **Data Encryption:** HTTPS for all communications
- **Input Validation:** Sanitize all user inputs to prevent SQL injection and XSS
- **Session Management:** Secure session tokens with expiration
- **Backup:** Regular database backups (automated daily backups recommended)

### 6.3 Scalability

- SQLite database should handle single-user workload efficiently
- Architecture should allow future migration to PostgreSQL/MySQL if multi-user support is added
- API design should be stateless to allow horizontal scaling

### 6.4 Usability

- Intuitive, modern UI following best practices
- Responsive design for desktop, tablet, and mobile
- Clear navigation and user workflows
- Helpful error messages and validation
- Onboarding tutorial for new users (future enhancement)

### 6.5 Reliability

- 99% uptime for web application
- Automatic error logging and monitoring
- Graceful error handling and user-friendly error messages

### 6.6 Maintainability

- Clean, modular code following industry best practices
- Comprehensive code comments and documentation
- Automated tests (unit and integration tests)
- Version control with Git

---

## 7. UI/UX Requirements

### 7.1 Design Principles

- **Modern and Clean:** Minimalist design with focus on usability
- **Professional:** Business-grade aesthetics suitable for accounting software
- **Responsive:** Mobile-first design, optimized for all screen sizes
- **Accessible:** WCAG 2.1 Level AA compliance

### 7.2 Key UI Components

- **Dashboard:**
  - Overview of key metrics (total income, expenses, profit, VAT liability)
  - Recent transactions
  - Upcoming VAT return deadlines
  - Quick actions (add transaction, create invoice)

- **Navigation:**
  - Sidebar menu with icons
  - Main sections: Dashboard, Transactions, Invoices, Customers, Reports, Settings

- **Forms:**
  - Clear labels and placeholders
  - Inline validation with helpful error messages
  - Auto-save (draft) functionality for invoices

- **Tables:**
  - Sortable columns
  - Pagination
  - Search and filter
  - Bulk actions (future enhancement)

- **Modals:**
  - For creating/editing transactions, invoices, customers
  - Confirmation dialogs for delete actions

### 7.3 Color Scheme

- Primary color: Professional blue (#1E3A8A or similar)
- Secondary color: Neutral gray (#6B7280)
- Success: Green (#10B981)
- Warning: Amber (#F59E0B)
- Error: Red (#EF4444)
- Background: Light gray (#F9FAFB)

### 7.4 Typography

- Font family: Inter, Roboto, or similar modern sans-serif
- Font sizes: Consistent scale (12px, 14px, 16px, 18px, 24px, 32px)

### 7.5 Wireframes

(To be created by design team)

---

## 8. Database Schema

### 8.1 Tables Overview

| Table            | Description                                      |
|------------------|--------------------------------------------------|
| users            | User account information                         |
| customers        | Customer records                                 |
| suppliers        | Supplier records                                 |
| transactions     | Income and expense transactions                  |
| invoices         | Invoice headers                                  |
| invoiceItems     | Invoice line items                               |
| bankAccounts     | Bank account details                             |
| bankTransactions | Bank statement transactions                      |
| reconciliations  | Reconciliation between bank and app transactions |
| vatReturns       | VAT return records                               |
| taxSettings      | Tax-related settings per user                    |
| categories       | Pre-defined chart of accounts                    |

### 8.2 Detailed Schema

#### users

| Column            | Type     | Description                       |
|-------------------|----------|-----------------------------------|
| id                | INTEGER  | Primary key                       |
| email             | TEXT     | Unique, not null                  |
| passwordHash      | TEXT     | Hashed password                   |
| name              | TEXT     | User full name                    |
| businessName      | TEXT     | Business/company name             |
| businessAddress   | TEXT     | Business address                  |
| vatNumber         | TEXT     | VAT registration number (if any)  |
| isVatRegistered   | BOOLEAN  | VAT registration status           |
| companyNumber     | TEXT     | Company registration number       |
| taxYearStart      | DATE     | Tax year start (default: 6 April) |
| preferredLanguage | TEXT     | 'en' or 'tr'                      |
| createdAt         | DATETIME | Creation timestamp                |
| updatedAt         | DATETIME | Last update timestamp             |

#### customers

| Column          | Type     | Description                |
|-----------------|----------|----------------------------|
| id              | INTEGER  | Primary key                |
| userId          | INTEGER  | Foreign key to users       |
| name            | TEXT     | Customer name              |
| contactPerson   | TEXT     | Contact person             |
| email           | TEXT     | Email address              |
| phone           | TEXT     | Phone number               |
| billingAddress  | TEXT     | Billing address            |
| shippingAddress | TEXT     | Shipping address           |
| vatNumber       | TEXT     | VAT number (if applicable) |
| paymentTerms    | TEXT     | Payment terms              |
| notes           | TEXT     | Additional notes           |
| createdAt       | DATETIME | Creation timestamp         |
| updatedAt       | DATETIME | Last update timestamp      |

#### suppliers

| Column        | Type     | Description                |
|---------------|----------|----------------------------|
| id            | INTEGER  | Primary key                |
| userId        | INTEGER  | Foreign key to users       |
| name          | TEXT     | Supplier name              |
| contactPerson | TEXT     | Contact person             |
| email         | TEXT     | Email address              |
| phone         | TEXT     | Phone number               |
| address       | TEXT     | Address                    |
| vatNumber     | TEXT     | VAT number (if applicable) |
| paymentTerms  | TEXT     | Payment terms              |
| notes         | TEXT     | Additional notes           |
| createdAt     | DATETIME | Creation timestamp         |
| updatedAt     | DATETIME | Last update timestamp      |

#### categories

| Column    | Type     | Description                               |
|-----------|----------|-------------------------------------------|
| id        | INTEGER  | Primary key                               |
| code      | TEXT     | Category code (e.g., 'INC001')            |
| nameEn    | TEXT     | Category name in English                  |
| nameTr    | TEXT     | Category name in Turkish                  |
| type      | TEXT     | 'income', 'expense', 'asset', 'liability' |
| isSystem  | BOOLEAN  | System-defined (not deletable)            |
| createdAt | DATETIME | Creation timestamp                        |

#### transactions

| Column        | Type     | Description                         |
|---------------|----------|-------------------------------------|
| id            | INTEGER  | Primary key                         |
| userId        | INTEGER  | Foreign key to users                |
| categoryId    | INTEGER  | Foreign key to categories           |
| customerId    | INTEGER  | Foreign key to customers (optional) |
| supplierId    | INTEGER  | Foreign key to suppliers (optional) |
| type          | TEXT     | 'income' or 'expense'               |
| date          | DATE     | Transaction date                    |
| amount        | DECIMAL  | Amount (excluding VAT)              |
| vatRate       | DECIMAL  | VAT rate (0, 5, 20)                 |
| vatAmount     | DECIMAL  | VAT amount                          |
| totalAmount   | DECIMAL  | Total (amount + VAT)                |
| description   | TEXT     | Description                         |
| paymentMethod | TEXT     | Cash, Bank Transfer, Card, etc.     |
| reference     | TEXT     | Reference number                    |
| attachmentUrl | TEXT     | Receipt/invoice attachment          |
| createdAt     | DATETIME | Creation timestamp                  |
| updatedAt     | DATETIME | Last update timestamp               |

#### invoices

| Column        | Type     | Description                   |
|---------------|----------|-------------------------------|
| id            | INTEGER  | Primary key                   |
| userId        | INTEGER  | Foreign key to users          |
| customerId    | INTEGER  | Foreign key to customers      |
| invoiceNumber | TEXT     | Unique invoice number         |
| invoiceDate   | DATE     | Invoice issue date            |
| dueDate       | DATE     | Payment due date              |
| subtotal      | DECIMAL  | Subtotal (excluding VAT)      |
| vatAmount     | DECIMAL  | Total VAT amount              |
| total         | DECIMAL  | Total amount (subtotal + VAT) |
| status        | TEXT     | 'draft', 'sent', 'paid', etc. |
| notes         | TEXT     | Additional notes/terms        |
| createdAt     | DATETIME | Creation timestamp            |
| updatedAt     | DATETIME | Last update timestamp         |

#### invoiceItems

| Column      | Type     | Description                        |
|-------------|----------|------------------------------------|
| id          | INTEGER  | Primary key                        |
| invoiceId   | INTEGER  | Foreign key to invoices            |
| description | TEXT     | Item description                   |
| quantity    | DECIMAL  | Quantity                           |
| unitPrice   | DECIMAL  | Price per unit (excluding VAT)     |
| vatRate     | DECIMAL  | VAT rate (0, 5, 20)                |
| vatAmount   | DECIMAL  | VAT amount                         |
| total       | DECIMAL  | Total (quantity * unitPrice + VAT) |
| createdAt   | DATETIME | Creation timestamp                 |

#### bankAccounts

| Column         | Type     | Description           |
|----------------|----------|-----------------------|
| id             | INTEGER  | Primary key           |
| userId         | INTEGER  | Foreign key to users  |
| accountName    | TEXT     | Account name          |
| accountNumber  | TEXT     | Account number        |
| sortCode       | TEXT     | Sort code (UK banks)  |
| openingBalance | DECIMAL  | Opening balance       |
| currentBalance | DECIMAL  | Current balance       |
| createdAt      | DATETIME | Creation timestamp    |
| updatedAt      | DATETIME | Last update timestamp |

#### bankTransactions

| Column        | Type     | Description                    |
|---------------|----------|--------------------------------|
| id            | INTEGER  | Primary key                    |
| bankAccountId | INTEGER  | Foreign key to bankAccounts    |
| date          | DATE     | Transaction date               |
| description   | TEXT     | Description                    |
| amount        | DECIMAL  | Amount (negative for outgoing) |
| balance       | DECIMAL  | Balance after transaction      |
| isReconciled  | BOOLEAN  | Reconciliation status          |
| createdAt     | DATETIME | Creation timestamp             |

#### reconciliations

| Column            | Type     | Description                     |
|-------------------|----------|---------------------------------|
| id                | INTEGER  | Primary key                     |
| bankTransactionId | INTEGER  | Foreign key to bankTransactions |
| appTransactionId  | INTEGER  | Foreign key to transactions     |
| reconciledAt      | DATETIME | Reconciliation timestamp        |

#### vatReturns

| Column      | Type     | Description                         |
|-------------|----------|-------------------------------------|
| id          | INTEGER  | Primary key                         |
| userId      | INTEGER  | Foreign key to users                |
| periodStart | DATE     | VAT period start date               |
| periodEnd   | DATE     | VAT period end date                 |
| box1        | DECIMAL  | VAT due on sales                    |
| box2        | DECIMAL  | VAT due on EC acquisitions          |
| box3        | DECIMAL  | Total VAT due                       |
| box4        | DECIMAL  | VAT reclaimed on purchases          |
| box5        | DECIMAL  | Net VAT to pay/reclaim              |
| box6        | DECIMAL  | Total sales excluding VAT           |
| box7        | DECIMAL  | Total purchases excluding VAT       |
| box8        | DECIMAL  | Total EC supplies excluding VAT     |
| box9        | DECIMAL  | Total EC acquisitions excluding VAT |
| status      | TEXT     | 'draft', 'filed', 'paid'            |
| filedAt     | DATETIME | Filing timestamp                    |
| createdAt   | DATETIME | Creation timestamp                  |

---

## 9. API Design

### 9.1 API Principles

- RESTful architecture
- JSON request/response format
- Stateless authentication (JWT tokens)
- Versioned API (e.g., /api/v1/...)
- Standard HTTP status codes

### 9.2 Key Endpoints

#### Authentication

| Method | Endpoint              | Description       |
|--------|-----------------------|-------------------|
| POST   | /api/v1/auth/register | Register user     |
| POST   | /api/v1/auth/login    | Login user        |
| POST   | /api/v1/auth/refresh  | Refresh JWT token |
| POST   | /api/v1/auth/logout   | Logout user       |

#### Users

| Method | Endpoint         | Description         |
|--------|------------------|---------------------|
| GET    | /api/v1/users/me | Get current user    |
| PUT    | /api/v1/users/me | Update user profile |

#### Transactions

| Method | Endpoint                 | Description        |
|--------|--------------------------|--------------------|
| GET    | /api/v1/transactions     | List transactions  |
| POST   | /api/v1/transactions     | Create transaction |
| GET    | /api/v1/transactions/:id | Get transaction    |
| PUT    | /api/v1/transactions/:id | Update transaction |
| DELETE | /api/v1/transactions/:id | Delete transaction |

#### Invoices

| Method | Endpoint                    | Description           |
|--------|-----------------------------|-----------------------|
| GET    | /api/v1/invoices            | List invoices         |
| POST   | /api/v1/invoices            | Create invoice        |
| GET    | /api/v1/invoices/:id        | Get invoice           |
| PUT    | /api/v1/invoices/:id        | Update invoice        |
| PATCH  | /api/v1/invoices/:id/status | Update invoice status |
| DELETE | /api/v1/invoices/:id        | Delete invoice        |
| GET    | /api/v1/invoices/:id/pdf    | Generate invoice PDF  |

#### Customers

| Method | Endpoint              | Description     |
|--------|-----------------------|-----------------|
| GET    | /api/v1/customers     | List customers  |
| POST   | /api/v1/customers     | Create customer |
| GET    | /api/v1/customers/:id | Get customer    |
| PUT    | /api/v1/customers/:id | Update customer |
| DELETE | /api/v1/customers/:id | Delete customer |

#### Suppliers

| Method | Endpoint              | Description     |
|--------|-----------------------|-----------------|
| GET    | /api/v1/suppliers     | List suppliers  |
| POST   | /api/v1/suppliers     | Create supplier |
| GET    | /api/v1/suppliers/:id | Get supplier    |
| PUT    | /api/v1/suppliers/:id | Update supplier |
| DELETE | /api/v1/suppliers/:id | Delete supplier |

#### Reports

| Method | Endpoint                      | Description          |
|--------|-------------------------------|----------------------|
| GET    | /api/v1/reports/profit-loss   | Profit & loss report |
| GET    | /api/v1/reports/balance-sheet | Balance sheet        |
| GET    | /api/v1/reports/cash-flow     | Cash flow statement  |
| GET    | /api/v1/reports/vat-return    | VAT return report    |

#### Bank Accounts

| Method | Endpoint                  | Description         |
|--------|---------------------------|---------------------|
| GET    | /api/v1/bank-accounts     | List bank accounts  |
| POST   | /api/v1/bank-accounts     | Create bank account |
| GET    | /api/v1/bank-accounts/:id | Get bank account    |
| PUT    | /api/v1/bank-accounts/:id | Update bank account |
| DELETE | /api/v1/bank-accounts/:id | Delete bank account |

#### Categories

| Method | Endpoint           | Description     |
|--------|--------------------|-----------------|
| GET    | /api/v1/categories | List categories |

#### Bank Transactions

| Method | Endpoint                                      | Description                |
|--------|-----------------------------------------------|----------------------------|
| GET    | /api/v1/bank-accounts/:accountId/transactions | List bank transactions     |
| POST   | /api/v1/bank-accounts/:accountId/transactions | Create bank transaction    |
| POST   | /api/v1/bank-transactions/:id/reconcile       | Reconcile bank transaction |

#### VAT Returns

| Method | Endpoint                       | Description              |
|--------|--------------------------------|--------------------------|
| GET    | /api/v1/vat-returns            | List VAT returns         |
| POST   | /api/v1/vat-returns            | Create VAT return        |
| GET    | /api/v1/vat-returns/:id        | Get VAT return           |
| PATCH  | /api/v1/vat-returns/:id/status | Update VAT return status |

#### Dashboard

| Method | Endpoint          | Description           |
|--------|-------------------|-----------------------|
| GET    | /api/v1/dashboard | Get dashboard summary |

#### Settings

| Method | Endpoint         | Description     |
|--------|------------------|-----------------|
| GET    | /api/v1/settings | Get settings    |
| PUT    | /api/v1/settings | Update settings |

---

## 10. Future Enhancements

The following features are not included in version 1.0 but may be considered for future releases:

### 10.1 Phase 2 Enhancements

- **Making Tax Digital (MTD) Integration:**
  - Direct submission of VAT returns to HMRC via API
  - OAuth 2.0 authentication with HMRC
  - Real-time VAT return status updates

- **Multi-User Support:**
  - Accountant and business owner roles
  - Permission-based access control
  - Collaboration features

- **Multi-Company Support:**
  - Single user managing multiple companies
  - Company switching
  - Consolidated reports

- **Email Integration:**
  - Send invoices via email
  - Email reminders for overdue invoices
  - Email notifications for important events

### 10.2 Phase 3 Enhancements

- **Advanced Reporting:**
  - Customizable reports
  - Export to Excel
  - Graphical dashboards with charts

- **Bank Feed Integration:**
  - Open Banking API integration
  - Automatic bank transaction import
  - Real-time reconciliation

- **Expense Management:**
  - Receipt scanning with OCR
  - Mobile app for expense capture
  - Mileage tracking

- **Payroll Enhancements:**
  - Full payroll system
  - Auto-enrolment pension management
  - P60/P45 generation
  - RTI (Real Time Information) submission

### 10.3 Phase 4 Enhancements

- **Mobile Application:**
  - Native iOS and Android apps
  - Offline mode
  - Push notifications

- **Third-Party Integrations:**
  - Stripe/PayPal for payment processing
  - Xero/QuickBooks import/export
  - CRM integrations

- **AI-Powered Features:**
  - Automatic expense categorization
  - Anomaly detection
  - Tax optimization suggestions

---

## 11. Development Phases

### Phase 1: Foundation (MVP)

**Core Features:**
- User authentication and profile management
- Income and expense tracking
- Basic transaction management
- Pre-defined UK chart of accounts
- Customer and supplier management
- Basic reports (Profit & Loss, Cash Flow)
- i18n support (Turkish/English)

**Deliverables:**
- Backend API (Node.js + Express)
- Frontend application (React)
- SQLite database setup
- User authentication
- Basic UI/UX

### Phase 2: Invoicing and VAT

**Core Features:**
- Invoice creation and management
- VAT calculation and tracking
- VAT return reporting
- Invoice PDF generation
- Bank account management

**Deliverables:**
- Invoicing module
- VAT calculation engine
- VAT return report generator
- PDF export functionality

### Phase 3: Bank Reconciliation and Tax Reports

**Core Features:**
- Bank transaction import and reconciliation
- Corporation Tax estimation
- Self Assessment summary
- PAYE/Payroll basic tracking
- Enhanced financial reports

**Deliverables:**
- Bank reconciliation module
- Tax calculation engines
- Comprehensive reporting system

### Phase 4: Polish and Optimization

**Core Features:**
- UI/UX refinements
- Performance optimization
- Security hardening
- Comprehensive testing
- User documentation

**Deliverables:**
- Production-ready application
- User manual (Turkish and English)
- Deployment guide
- Test coverage reports

---

## 12. Risks and Assumptions

### 12.1 Risks

| Risk                                   | Impact | Mitigation Strategy                                  |
|----------------------------------------|--------|------------------------------------------------------|
| UK tax legislation changes             | High   | Monitor HMRC updates, design flexible tax engine     |
| Incorrect tax calculations             | High   | Thorough testing against HMRC examples, QA process   |
| Data loss or corruption                | High   | Automated backups, data validation, audit trails     |
| Security vulnerabilities               | High   | Security audits, penetration testing, best practices |
| Poor user adoption                     | Medium | User research, beta testing, user-friendly design    |
| Performance issues with large datasets | Medium | Database optimization, pagination, caching           |
| Localization errors                    | Low    | Native speaker review, comprehensive testing         |

### 12.2 Assumptions

- **Users do NOT need prior accounting knowledge** - the system will educate them through guided workflows
- Users are operating legitimate businesses in the UK
- Users have internet access for web application
- UK tax rates and regulations remain relatively stable during development
- Users are responsible for accuracy of data entered (system provides validation and warnings)
- Users will manually file tax returns with HMRC in Phase 1 (MTD API in Phase 2)
- Users are comfortable using web applications and can follow step-by-step instructions

### 12.3 Legal Disclaimer and User Responsibility

**Application Purpose:**

This application is designed to **empower small business owners and sole traders to manage their accounting and tax obligations independently**, without requiring professional accounting services for routine tasks. The system provides:

- Accurate tax calculations based on current UK legislation
- Comprehensive guidance and educational content
- Step-by-step filing instructions
- Built-in compliance checks and validation

**User Responsibilities:**

While the system is designed for independent use, users remain responsible for:

1. **Data Accuracy:** Entering transactions, invoices, and business information correctly
2. **Final Review:** Reviewing all reports and calculations before submission to HMRC
3. **Record Keeping:** Maintaining supporting documentation (receipts, invoices, contracts) as required by UK law
4. **Staying Informed:** Being aware of changes to tax legislation (system will notify of major changes)
5. **Complex Situations:** Seeking professional advice for unusual or complex circumstances, including:
   - International transactions and VAT reverse charge
   - Capital allowances and R&D tax credits
   - Company restructuring or mergers
   - Tax investigations or disputes with HMRC
   - First-year setup (optional - system can guide you through it)

**When Professional Help is Recommended:**

The system will automatically suggest consulting an accountant when:
- Annual turnover exceeds £500,000
- Complex international transactions detected
- Multiple company structures
- Tax optimization opportunities beyond basic scope

**Legal Limitation:**

While every effort is made to ensure accuracy and compliance, this software is provided "as is" without warranty. The developers are not liable for financial losses, penalties, or legal issues arising from the use of this application. However, we commit to:
- Regular updates to reflect HMRC changes
- Rigorous testing of tax calculations
- Responsive support for reported issues
- Continuous improvement based on user feedback

**Best Practice:**

For first-time users, we recommend having an accountant review your first year-end accounts and tax returns to verify the system's output and ensure you're using it correctly. After that, most users can confidently manage their accounting independently.

---

## 13. Success Criteria

The project will be considered successful if it meets the following criteria:

### 13.1 Core Functionality
- All core features (income/expense tracking, invoicing, VAT, bank reconciliation, reports) are fully functional
- User can complete entire accounting cycle from transaction entry to tax return without external tools

### 13.2 Compliance and Accuracy
- **100% accuracy** in UK tax calculations (VAT, Corporation Tax, Self Assessment, PAYE)
- Zero calculation errors identified in beta testing against HMRC examples
- All invoices meet HMRC compliance requirements

### 13.3 User Independence
- **80%+ of users** successfully complete their first VAT return without external help
- **90%+ reduction** in accounting costs compared to using professional services
- Average user requires less than 1 hour per week for accounting tasks
- Users report feeling confident managing their taxes independently

### 13.4 User Experience
- User satisfaction score above 4.5/5 in beta testing
- Average onboarding completion time under 30 minutes
- 90%+ of users complete onboarding wizard
- Help content and guidance rated as "helpful" or "very helpful" by 85%+ users

### 13.5 Performance and Reliability
- Application loads in under 3 seconds on standard broadband
- Handles 10,000+ transactions per user per year without performance degradation
- 99% uptime for web application
- No critical bugs in production

### 13.6 Localization and Accessibility
- Full Turkish and English support with no translation errors
- Turkish-speaking users rate language quality as native-level
- All educational content available in both languages

### 13.7 Security
- No critical or high-severity security vulnerabilities identified in audit
- 100% of user data encrypted in transit and at rest
- Zero data breaches or unauthorized access incidents

### 13.8 Business Impact
- 500+ active users within 6 months of launch
- 70%+ user retention after 12 months
- Net Promoter Score (NPS) above 50
- Featured in UK Turkish business community publications

---

## 14. Appendices

### Appendix A: Glossary

| Term                    | Definition                                           |
|-------------------------|------------------------------------------------------|
| HMRC                    | Her Majesty's Revenue and Customs (UK tax authority) |
| VAT                     | Value Added Tax (similar to sales tax)               |
| MTD                     | Making Tax Digital (HMRC's digital tax initiative)   |
| Corporation Tax         | Tax on company profits                               |
| Self Assessment         | Annual tax return for self-employed individuals      |
| PAYE                    | Pay As You Earn (employee income tax withholding)    |
| National Insurance (NI) | Social security contributions in the UK              |
| FPS                     | Full Payment Submission (payroll report to HMRC)     |
| EPS                     | Employer Payment Summary (additional payroll report) |
| P60                     | Annual tax summary for employees                     |
| P45                     | Tax form when leaving employment                     |
| RTI                     | Real Time Information (payroll reporting system)     |
| i18n                    | Internationalization (multi-language support)        |

### Appendix B: References

- HMRC Official Website: https://www.gov.uk/government/organisations/hm-revenue-customs
- VAT Rates: https://www.gov.uk/vat-rates
- Corporation Tax: https://www.gov.uk/corporation-tax
- Self Assessment: https://www.gov.uk/self-assessment-tax-returns
- PAYE: https://www.gov.uk/paye-for-employers
- Making Tax Digital: https://www.gov.uk/making-tax-digital

### Appendix C: Contact Information

**Project Owner:** [To be determined]
**Product Manager:** [To be determined]
**Technical Lead:** [To be determined]

---

**Document Control**

| Version | Date       | Author      | Changes                                                                                                                                                                                                         |
|---------|------------|-------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1.0     | 2026-01-12 | Claude Code | Initial draft                                                                                                                                                                                                   |
| 1.1     | 2026-01-12 | Claude Code | Updated philosophy to "accountant-free", added User Guidance System (4.5), updated MTD to Phase 2, revised legal disclaimer, enhanced success criteria                                                          |
| 1.2     | 2026-01-12 | Claude Code | Updated all database schema to camelCase, updated table names (invoiceItems, bankAccounts, etc.), added missing API endpoints (refresh, status updates, dashboard, settings), confirmed box naming as box1-box9 |

---

**End of Document**
