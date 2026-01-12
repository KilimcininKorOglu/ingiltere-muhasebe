# API Documentation
## UK Pre-Accounting Application - RESTful API Reference

**Version:** 1.1
**Base URL:** `https://api.ukaccounting.app` (Production)
**Base URL:** `http://localhost:3000` (Development)
**API Version:** `/api/v1`
**Date:** 2026-01-12
**Naming Convention:** camelCase for all fields and properties

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Common Patterns](#common-patterns)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Data Models](#data-models)
7. [API Endpoints](#api-endpoints)
   - [Authentication](#authentication-endpoints)
   - [Users](#users-endpoints)
   - [Transactions](#transactions-endpoints)
   - [Invoices](#invoices-endpoints)
   - [Customers](#customers-endpoints)
   - [Suppliers](#suppliers-endpoints)
   - [Bank Accounts](#bank-accounts-endpoints)
   - [Bank Transactions](#bank-transactions-endpoints)
   - [Categories](#categories-endpoints)
   - [Reports](#reports-endpoints)
   - [VAT Returns](#vat-returns-endpoints)
   - [Dashboard](#dashboard-endpoints)
   - [Settings](#settings-endpoints)
8. [Webhooks](#webhooks)
9. [Changelog](#changelog)

---

## Overview

### API Principles

- **RESTful Architecture:** Resources are accessed via standard HTTP methods (GET, POST, PUT, DELETE)
- **JSON Format:** All requests and responses use JSON format
- **Stateless:** Each request contains all necessary information (JWT token)
- **Versioned:** API version is included in the URL (`/api/v1/`)
- **Pagination:** List endpoints support pagination
- **Filtering:** List endpoints support filtering and sorting
- **Idempotency:** POST/PUT requests are idempotent where appropriate

### HTTP Methods

| Method | Usage                                  |
|--------|----------------------------------------|
| GET    | Retrieve resource(s)                   |
| POST   | Create new resource                    |
| PUT    | Update existing resource (full update) |
| PATCH  | Update existing resource (partial)     |
| DELETE | Delete resource                        |

### HTTP Status Codes

| Code | Meaning               | Usage                                   |
|------|-----------------------|-----------------------------------------|
| 200  | OK                    | Successful GET, PUT, PATCH, DELETE      |
| 201  | Created               | Successful POST creating a resource     |
| 204  | No Content            | Successful DELETE with no response body |
| 400  | Bad Request           | Invalid request format or parameters    |
| 401  | Unauthorized          | Missing or invalid authentication token |
| 403  | Forbidden             | Authenticated but not authorized        |
| 404  | Not Found             | Resource not found                      |
| 409  | Conflict              | Resource conflict (e.g., duplicate)     |
| 422  | Unprocessable Entity  | Validation error                        |
| 429  | Too Many Requests     | Rate limit exceeded                     |
| 500  | Internal Server Error | Server error                            |
| 503  | Service Unavailable   | Server temporarily unavailable          |

---

## Authentication

### Authentication Flow

The API uses **JWT (JSON Web Token)** for authentication.

#### 1. Register or Login

```http
POST /api/v1/auth/register
POST /api/v1/auth/login
```

#### 2. Receive JWT Token

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### 3. Include Token in Subsequent Requests

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Expiration

- Access tokens expire after **24 hours**
- Refresh tokens expire after **30 days**
- Use `/api/v1/auth/refresh` to get a new access token

### Security Best Practices

- Always use HTTPS in production
- Store tokens securely (e.g., secure storage on mobile, httpOnly cookies on web)
- Never expose tokens in URLs or logs
- Implement token refresh logic before expiration

---

## Common Patterns

### Request Headers

All requests should include:

```http
Content-Type: application/json
Authorization: Bearer {token}
Accept-Language: en-GB (or tr-TR)
```

### Pagination

List endpoints support pagination via query parameters:

```http
GET /api/v1/transactions?page=1&limit=20
```

**Response:**

```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

**Query Parameters:**

| Parameter | Type    | Default | Description               |
|-----------|---------|---------|---------------------------|
| page      | integer | 1       | Page number (1-indexed)   |
| limit     | integer | 20      | Items per page (max: 100) |

### Filtering

Filter results using query parameters:

```http
GET /api/v1/transactions?type=income&date_from=2026-01-01&date_to=2026-01-31
```

### Sorting

Sort results using the `sort` parameter:

```http
GET /api/v1/transactions?sort=-date (descending)
GET /api/v1/transactions?sort=amount (ascending)
```

### Searching

Search across multiple fields:

```http
GET /api/v1/customers?search=john
```

---

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      },
      {
        "field": "amount",
        "message": "Amount must be greater than 0"
      }
    ]
  }
}
```

### Error Codes

| Code                  | HTTP Status | Description                       |
|-----------------------|-------------|-----------------------------------|
| VALIDATION_ERROR      | 422         | Request validation failed         |
| UNAUTHORIZED          | 401         | Invalid or missing authentication |
| FORBIDDEN             | 403         | User lacks permission             |
| NOT_FOUND             | 404         | Resource not found                |
| DUPLICATE_ENTRY       | 409         | Resource already exists           |
| RATE_LIMIT_EXCEEDED   | 429         | Too many requests                 |
| INTERNAL_SERVER_ERROR | 500         | Unexpected server error           |

### Field Validation Errors

Validation errors include field-specific details:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "vat_rate",
        "message": "VAT rate must be 0, 5, or 20",
        "value": 15,
        "constraint": "enum"
      }
    ]
  }
}
```

---

## Rate Limiting

### Limits

| Endpoint Type     | Limit              |
|-------------------|--------------------|
| Authentication    | 10 requests/hour   |
| Read Operations   | 1000 requests/hour |
| Write Operations  | 500 requests/hour  |
| Report Generation | 100 requests/hour  |

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1609459200
```

### Rate Limit Exceeded Response

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later.",
    "retryAfter": 3600
  }
}
```

---

## Data Models

### User

```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "businessName": "ABC Ltd",
  "businessAddress": "123 High Street, London, UK",
  "vatNumber": "GB123456789",
  "isVatRegistered": true,
  "companyNumber": "12345678",
  "taxYearStart": "2025-04-06",
  "preferredLanguage": "en",
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-01T00:00:00Z"
}
```

### Transaction

```json
{
  "id": 123,
  "userId": 1,
  "type": "income",
  "categoryId": 5,
  "customerId": 10,
  "supplierId": null,
  "date": "2026-01-15",
  "amount": 500.00,
  "vatRate": 20,
  "vatAmount": 100.00,
  "totalAmount": 600.00,
  "description": "Consulting services",
  "paymentMethod": "bank_transfer",
  "reference": "INV-001",
  "attachmentUrl": null,
  "createdAt": "2026-01-15T10:30:00Z",
  "updatedAt": "2026-01-15T10:30:00Z"
}
```

### Invoice

```json
{
  "id": 456,
  "userId": 1,
  "customerId": 10,
  "invoiceNumber": "INV-2026-001",
  "invoiceDate": "2026-01-15",
  "dueDate": "2026-02-15",
  "subtotal": 500.00,
  "vatAmount": 100.00,
  "total": 600.00,
  "status": "sent",
  "notes": "Payment due within 30 days",
  "items": [
    {
      "id": 1,
      "description": "Consulting services",
      "quantity": 10,
      "unitPrice": 50.00,
      "vatRate": 20,
      "vatAmount": 100.00,
      "total": 600.00
    }
  ],
  "customer": {
    "id": 10,
    "name": "Client Ltd",
    "email": "client@example.com",
    "billingAddress": "456 Business Rd, London, UK"
  },
  "createdAt": "2026-01-15T10:00:00Z",
  "updatedAt": "2026-01-15T10:00:00Z"
}
```

### Customer

```json
{
  "id": 10,
  "userId": 1,
  "name": "Client Ltd",
  "contactPerson": "Jane Smith",
  "email": "jane@client.com",
  "phone": "+44 20 1234 5678",
  "billingAddress": "456 Business Rd, London, UK",
  "shippingAddress": "456 Business Rd, London, UK",
  "vatNumber": "GB987654321",
  "paymentTerms": "Net 30",
  "notes": "Preferred customer",
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-01T00:00:00Z"
}
```

### Category

```json
{
  "id": 5,
  "code": "INC001",
  "nameEn": "Sales",
  "nameTr": "Satışlar",
  "type": "income",
  "isSystem": true,
  "createdAt": "2026-01-01T00:00:00Z"
}
```

### Bank Account

```json
{
  "id": 7,
  "userId": 1,
  "accountName": "Business Current Account",
  "accountNumber": "12345678",
  "sortCode": "12-34-56",
  "openingBalance": 1000.00,
  "currentBalance": 5000.00,
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-15T10:00:00Z"
}
```

### VAT Return

```json
{
  "id": 3,
  "userId": 1,
  "periodStart": "2026-01-01",
  "periodEnd": "2026-03-31",
  "box1": 2450.00,
  "box2": 0.00,
  "box3": 2450.00,
  "box4": 850.00,
  "box5": 1600.00,
  "box6": 12250.00,
  "box7": 4250.00,
  "box8": 0.00,
  "box9": 0.00,
  "status": "draft",
  "filedAt": null,
  "createdAt": "2026-04-01T00:00:00Z"
}
```

---

## API Endpoints

### Authentication Endpoints

#### Register User

```http
POST /api/v1/auth/register
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe",
  "businessName": "ABC Ltd",
  "preferredLanguage": "en"
}
```

**Response (201 Created):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "businessName": "ABC Ltd",
    "preferredLanguage": "en"
  }
}
```

**Validation Rules:**

- `email`: Required, valid email format, unique
- `password`: Required, min 8 characters, must include uppercase, lowercase, number, special character
- `name`: Required, max 100 characters
- `businessName`: Required, max 200 characters
- `preferredLanguage`: Optional, enum: `en`, `tr` (default: `en`)

---

#### Login

```http
POST /api/v1/auth/login
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200 OK):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "businessName": "ABC Ltd",
    "preferredLanguage": "en"
  }
}
```

**Error Response (401 Unauthorized):**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid email or password"
  }
}
```

---

#### Refresh Token

```http
POST /api/v1/auth/refresh
```

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### Logout

```http
POST /api/v1/auth/logout
```

**Headers:**

```http
Authorization: Bearer {token}
```

**Response (204 No Content)**

---

### Users Endpoints

#### Get Current User

```http
GET /api/v1/users/me
```

**Headers:**

```http
Authorization: Bearer {token}
```

**Response (200 OK):**

```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "businessName": "ABC Ltd",
  "businessAddress": "123 High Street, London, UK",
  "vatNumber": "GB123456789",
  "isVatRegistered": true,
  "companyNumber": "12345678",
  "taxYearStart": "2025-04-06",
  "preferredLanguage": "en",
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-01T00:00:00Z"
}
```

---

#### Update User Profile

```http
PUT /api/v1/users/me
```

**Request Body:**

```json
{
  "name": "John Smith",
  "businessName": "ABC Limited",
  "businessAddress": "123 High Street, London, SW1A 1AA, UK",
  "vatNumber": "GB123456789",
  "isVatRegistered": true,
  "companyNumber": "12345678",
  "preferredLanguage": "tr"
}
```

**Response (200 OK):**

```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Smith",
  "businessName": "ABC Limited",
  "businessAddress": "123 High Street, London, SW1A 1AA, UK",
  "vatNumber": "GB123456789",
  "isVatRegistered": true,
  "companyNumber": "12345678",
  "taxYearStart": "2025-04-06",
  "preferredLanguage": "tr",
  "updatedAt": "2026-01-15T10:00:00Z"
}
```

**Validation Rules:**

- `vatNumber`: Must match UK VAT format (GB + 9 digits)
- `companyNumber`: Must be 8 digits
- `preferredLanguage`: enum: `en`, `tr`

---

### Transactions Endpoints

#### List Transactions

```http
GET /api/v1/transactions
```

**Query Parameters:**

| Parameter  | Type    | Description                                 |
|------------|---------|---------------------------------------------|
| page       | integer | Page number (default: 1)                    |
| limit      | integer | Items per page (default: 20, max: 100)      |
| type       | string  | Filter by type: `income`, `expense`         |
| categoryId | integer | Filter by category ID                       |
| customerId | integer | Filter by customer ID                       |
| supplierId | integer | Filter by supplier ID                       |
| dateFrom   | date    | Filter from date (YYYY-MM-DD)               |
| dateTo     | date    | Filter to date (YYYY-MM-DD)                 |
| search     | string  | Search in description                       |
| sort       | string  | Sort field (prefix with `-` for descending) |

**Example Request:**

```http
GET /api/v1/transactions?type=income&dateFrom=2026-01-01&dateTo=2026-01-31&sort=-date&limit=50
```

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": 123,
      "userId": 1,
      "type": "income",
      "categoryId": 5,
      "category": {
        "id": 5,
        "nameEn": "Sales",
        "nameTr": "Satışlar"
      },
      "customerId": 10,
      "customer": {
        "id": 10,
        "name": "Client Ltd"
      },
      "supplierId": null,
      "date": "2026-01-15",
      "amount": 500.00,
      "vatRate": 20,
      "vatAmount": 100.00,
      "totalAmount": 600.00,
      "description": "Consulting services",
      "paymentMethod": "bank_transfer",
      "reference": "INV-001",
      "attachmentUrl": null,
      "createdAt": "2026-01-15T10:30:00Z",
      "updatedAt": "2026-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3
  }
}
```

---

#### Create Transaction

```http
POST /api/v1/transactions
```

**Request Body:**

```json
{
  "type": "income",
  "categoryId": 5,
  "customerId": 10,
  "date": "2026-01-15",
  "amount": 500.00,
  "vatRate": 20,
  "description": "Consulting services",
  "paymentMethod": "bank_transfer",
  "reference": "INV-001"
}
```

**Response (201 Created):**

```json
{
  "id": 123,
  "userId": 1,
  "type": "income",
  "categoryId": 5,
  "customerId": 10,
  "supplierId": null,
  "date": "2026-01-15",
  "amount": 500.00,
  "vatRate": 20,
  "vatAmount": 100.00,
  "totalAmount": 600.00,
  "description": "Consulting services",
  "paymentMethod": "bank_transfer",
  "reference": "INV-001",
  "attachmentUrl": null,
  "createdAt": "2026-01-15T10:30:00Z",
  "updatedAt": "2026-01-15T10:30:00Z"
}
```

**Validation Rules:**

- `type`: Required, enum: `income`, `expense`
- `categoryId`: Required, must exist in categories table
- `customerId`: Optional, must exist if provided (required for income)
- `supplierId`: Optional, must exist if provided (required for expense)
- `date`: Required, format: YYYY-MM-DD, cannot be future date
- `amount`: Required, decimal, min: 0.01, max: 999999.99
- `vatRate`: Required, enum: 0, 5, 20
- `description`: Required, max: 500 characters
- `paymentMethod`: Required, enum: `cash`, `bank_transfer`, `card`, `direct_debit`, `other`
- `reference`: Optional, max: 100 characters

**Auto-Calculated Fields:**

- `vatAmount`: Automatically calculated as `amount * (vatRate / 100)`
- `totalAmount`: Automatically calculated as `amount + vatAmount`

---

#### Get Transaction

```http
GET /api/v1/transactions/:id
```

**Response (200 OK):**

```json
{
  "id": 123,
  "userId": 1,
  "type": "income",
  "categoryId": 5,
  "category": {
    "id": 5,
    "code": "INC001",
    "nameEn": "Sales",
    "nameTr": "Satışlar"
  },
  "customerId": 10,
  "customer": {
    "id": 10,
    "name": "Client Ltd",
    "email": "client@example.com"
  },
  "supplierId": null,
  "date": "2026-01-15",
  "amount": 500.00,
  "vatRate": 20,
  "vatAmount": 100.00,
  "totalAmount": 600.00,
  "description": "Consulting services",
  "paymentMethod": "bank_transfer",
  "reference": "INV-001",
  "attachmentUrl": null,
  "createdAt": "2026-01-15T10:30:00Z",
  "updatedAt": "2026-01-15T10:30:00Z"
}
```

---

#### Update Transaction

```http
PUT /api/v1/transactions/:id
```

**Request Body:**

```json
{
  "amount": 600.00,
  "description": "Updated consulting services description"
}
```

**Response (200 OK):**

```json
{
  "id": 123,
  "userId": 1,
  "type": "income",
  "categoryId": 5,
  "customerId": 10,
  "supplierId": null,
  "date": "2026-01-15",
  "amount": 600.00,
  "vatRate": 20,
  "vatAmount": 120.00,
  "totalAmount": 720.00,
  "description": "Updated consulting services description",
  "paymentMethod": "bank_transfer",
  "reference": "INV-001",
  "attachmentUrl": null,
  "createdAt": "2026-01-15T10:30:00Z",
  "updatedAt": "2026-01-15T14:00:00Z"
}
```

---

#### Delete Transaction

```http
DELETE /api/v1/transactions/:id
```

**Response (204 No Content)**

**Error Response (404 Not Found):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Transaction not found"
  }
}
```

---

### Invoices Endpoints

#### List Invoices

```http
GET /api/v1/invoices
```

**Query Parameters:**

| Parameter  | Type    | Description                                                       |
|------------|---------|-------------------------------------------------------------------|
| page       | integer | Page number (default: 1)                                          |
| limit      | integer | Items per page (default: 20, max: 100)                            |
| customerId | integer | Filter by customer ID                                             |
| status     | string  | Filter by status: `draft`, `sent`, `paid`, `overdue`, `cancelled` |
| dateFrom   | date    | Filter from date (YYYY-MM-DD)                                     |
| dateTo     | date    | Filter to date (YYYY-MM-DD)                                       |
| search     | string  | Search in invoice number or customer name                         |
| sort       | string  | Sort field (prefix with `-` for descending)                       |

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": 456,
      "userId": 1,
      "customerId": 10,
      "customer": {
        "id": 10,
        "name": "Client Ltd",
        "email": "client@example.com"
      },
      "invoiceNumber": "INV-2026-001",
      "invoiceDate": "2026-01-15",
      "dueDate": "2026-02-15",
      "subtotal": 500.00,
      "vatAmount": 100.00,
      "total": 600.00,
      "status": "sent",
      "notes": "Payment due within 30 days",
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

#### Create Invoice

```http
POST /api/v1/invoices
```

**Request Body:**

```json
{
  "customerId": 10,
  "invoiceDate": "2026-01-15",
  "dueDate": "2026-02-15",
  "notes": "Payment due within 30 days",
  "items": [
    {
      "description": "Consulting services",
      "quantity": 10,
      "unitPrice": 50.00,
      "vatRate": 20
    },
    {
      "description": "Additional services",
      "quantity": 5,
      "unitPrice": 30.00,
      "vatRate": 20
    }
  ]
}
```

**Response (201 Created):**

```json
{
  "id": 456,
  "userId": 1,
  "customerId": 10,
  "invoiceNumber": "INV-2026-001",
  "invoiceDate": "2026-01-15",
  "dueDate": "2026-02-15",
  "subtotal": 650.00,
  "vatAmount": 130.00,
  "total": 780.00,
  "status": "draft",
  "notes": "Payment due within 30 days",
  "items": [
    {
      "id": 1,
      "description": "Consulting services",
      "quantity": 10,
      "unitPrice": 50.00,
      "vatRate": 20,
      "vatAmount": 100.00,
      "total": 600.00
    },
    {
      "id": 2,
      "description": "Additional services",
      "quantity": 5,
      "unitPrice": 30.00,
      "vatRate": 20,
      "vatAmount": 30.00,
      "total": 180.00
    }
  ],
  "createdAt": "2026-01-15T10:00:00Z",
  "updatedAt": "2026-01-15T10:00:00Z"
}
```

**Validation Rules:**

- `customerId`: Required, must exist
- `invoiceDate`: Required, format: YYYY-MM-DD
- `dueDate`: Required, format: YYYY-MM-DD, must be >= invoiceDate
- `notes`: Optional, max: 1000 characters
- `items`: Required, array, min: 1 item
- `items[].description`: Required, max: 500 characters
- `items[].quantity`: Required, decimal, min: 0.01
- `items[].unitPrice`: Required, decimal, min: 0.01
- `items[].vatRate`: Required, enum: 0, 5, 20

**Auto-Generated Fields:**

- `invoiceNumber`: Auto-generated sequential number (format: INV-YYYY-NNN)
- `subtotal`: Sum of all items' (quantity * unitPrice)
- `vatAmount`: Sum of all items' VAT amounts
- `total`: subtotal + vatAmount

---

#### Get Invoice

```http
GET /api/v1/invoices/:id
```

**Response (200 OK):**

```json
{
  "id": 456,
  "userId": 1,
  "customerId": 10,
  "customer": {
    "id": 10,
    "name": "Client Ltd",
    "contactPerson": "Jane Smith",
    "email": "jane@client.com",
    "phone": "+44 20 1234 5678",
    "billingAddress": "456 Business Rd, London, UK",
    "vatNumber": "GB987654321"
  },
  "invoiceNumber": "INV-2026-001",
  "invoiceDate": "2026-01-15",
  "dueDate": "2026-02-15",
  "subtotal": 500.00,
  "vatAmount": 100.00,
  "total": 600.00,
  "status": "sent",
  "notes": "Payment due within 30 days",
  "items": [
    {
      "id": 1,
      "description": "Consulting services",
      "quantity": 10,
      "unitPrice": 50.00,
      "vatRate": 20,
      "vatAmount": 100.00,
      "total": 600.00
    }
  ],
  "createdAt": "2026-01-15T10:00:00Z",
  "updatedAt": "2026-01-15T10:00:00Z"
}
```

---

#### Update Invoice

```http
PUT /api/v1/invoices/:id
```

**Note:** Can only update invoices with status `draft`

**Request Body:**

```json
{
  "dueDate": "2026-02-20",
  "notes": "Extended payment terms",
  "items": [
    {
      "description": "Updated consulting services",
      "quantity": 12,
      "unitPrice": 50.00,
      "vatRate": 20
    }
  ]
}
```

**Response (200 OK):**

```json
{
  "id": 456,
  "userId": 1,
  "customerId": 10,
  "invoiceNumber": "INV-2026-001",
  "invoiceDate": "2026-01-15",
  "dueDate": "2026-02-20",
  "subtotal": 600.00,
  "vatAmount": 120.00,
  "total": 720.00,
  "status": "draft",
  "notes": "Extended payment terms",
  "items": [
    {
      "id": 1,
      "description": "Updated consulting services",
      "quantity": 12,
      "unitPrice": 50.00,
      "vatRate": 20,
      "vatAmount": 120.00,
      "total": 720.00
    }
  ],
  "updatedAt": "2026-01-15T14:00:00Z"
}
```

---

#### Update Invoice Status

```http
PATCH /api/v1/invoices/:id/status
```

**Request Body:**

```json
{
  "status": "sent"
}
```

**Valid Status Transitions:**

- `draft` → `sent`, `cancelled`
- `sent` → `paid`, `overdue`, `cancelled`
- `overdue` → `paid`, `cancelled`
- `paid` → (no transitions allowed)
- `cancelled` → (no transitions allowed)

**Response (200 OK):**

```json
{
  "id": 456,
  "status": "sent",
  "updatedAt": "2026-01-15T14:00:00Z"
}
```

---

#### Generate Invoice PDF

```http
GET /api/v1/invoices/:id/pdf
```

**Response Headers:**

```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="INV-2026-001.pdf"
```

**Response:** PDF file (binary)

---

#### Delete Invoice

```http
DELETE /api/v1/invoices/:id
```

**Note:** Can only delete invoices with status `draft`

**Response (204 No Content)**

---

### Customers Endpoints

#### List Customers

```http
GET /api/v1/customers
```

**Query Parameters:**

| Parameter | Type    | Description                            |
|-----------|---------|----------------------------------------|
| page      | integer | Page number (default: 1)               |
| limit     | integer | Items per page (default: 20, max: 100) |
| search    | string  | Search in name, email, contact person  |
| sort      | string  | Sort field (default: `name`)           |

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": 10,
      "userId": 1,
      "name": "Client Ltd",
      "contactPerson": "Jane Smith",
      "email": "jane@client.com",
      "phone": "+44 20 1234 5678",
      "billingAddress": "456 Business Rd, London, UK",
      "shippingAddress": "456 Business Rd, London, UK",
      "vatNumber": "GB987654321",
      "paymentTerms": "Net 30",
      "notes": "Preferred customer",
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 25,
    "totalPages": 2
  }
}
```

---

#### Create Customer

```http
POST /api/v1/customers
```

**Request Body:**

```json
{
  "name": "Client Ltd",
  "contactPerson": "Jane Smith",
  "email": "jane@client.com",
  "phone": "+44 20 1234 5678",
  "billingAddress": "456 Business Rd, London, SW1A 1AA, UK",
  "shippingAddress": "456 Business Rd, London, SW1A 1AA, UK",
  "vatNumber": "GB987654321",
  "paymentTerms": "Net 30",
  "notes": "Preferred customer"
}
```

**Response (201 Created):**

```json
{
  "id": 10,
  "userId": 1,
  "name": "Client Ltd",
  "contactPerson": "Jane Smith",
  "email": "jane@client.com",
  "phone": "+44 20 1234 5678",
  "billingAddress": "456 Business Rd, London, SW1A 1AA, UK",
  "shippingAddress": "456 Business Rd, London, SW1A 1AA, UK",
  "vatNumber": "GB987654321",
  "paymentTerms": "Net 30",
  "notes": "Preferred customer",
  "createdAt": "2026-01-15T10:00:00Z",
  "updatedAt": "2026-01-15T10:00:00Z"
}
```

**Validation Rules:**

- `name`: Required, max: 200 characters
- `contactPerson`: Optional, max: 100 characters
- `email`: Optional, valid email format
- `phone`: Optional, max: 50 characters
- `billingAddress`: Optional, max: 500 characters
- `shippingAddress`: Optional, max: 500 characters
- `vatNumber`: Optional, UK VAT format (GB + 9 digits)
- `paymentTerms`: Optional, max: 100 characters
- `notes`: Optional, max: 1000 characters

---

#### Get Customer

```http
GET /api/v1/customers/:id
```

**Response (200 OK):**

```json
{
  "id": 10,
  "userId": 1,
  "name": "Client Ltd",
  "contactPerson": "Jane Smith",
  "email": "jane@client.com",
  "phone": "+44 20 1234 5678",
  "billingAddress": "456 Business Rd, London, SW1A 1AA, UK",
  "shippingAddress": "456 Business Rd, London, SW1A 1AA, UK",
  "vatNumber": "GB987654321",
  "paymentTerms": "Net 30",
  "notes": "Preferred customer",
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-01T00:00:00Z"
}
```

---

#### Update Customer

```http
PUT /api/v1/customers/:id
```

**Request Body:**

```json
{
  "name": "Client Limited",
  "email": "info@client.com"
}
```

**Response (200 OK):** Updated customer object

---

#### Delete Customer

```http
DELETE /api/v1/customers/:id
```

**Response (204 No Content)**

**Error Response (409 Conflict):**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Cannot delete customer with existing invoices or transactions"
  }
}
```

---

### Suppliers Endpoints

Supplier endpoints follow the same pattern as Customer endpoints.

#### List Suppliers

```http
GET /api/v1/suppliers
```

#### Create Supplier

```http
POST /api/v1/suppliers
```

#### Get Supplier

```http
GET /api/v1/suppliers/:id
```

#### Update Supplier

```http
PUT /api/v1/suppliers/:id
```

#### Delete Supplier

```http
DELETE /api/v1/suppliers/:id
```

*See Customer endpoints for detailed request/response formats*

---

### Bank Accounts Endpoints

#### List Bank Accounts

```http
GET /api/v1/bank-accounts
```

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": 7,
      "userId": 1,
      "accountName": "Business Current Account",
      "accountNumber": "12345678",
      "sortCode": "12-34-56",
      "openingBalance": 1000.00,
      "currentBalance": 5000.00,
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-15T10:00:00Z"
    }
  ]
}
```

---

#### Create Bank Account

```http
POST /api/v1/bank-accounts
```

**Request Body:**

```json
{
  "accountName": "Business Current Account",
  "accountNumber": "12345678",
  "sortCode": "12-34-56",
  "openingBalance": 1000.00
}
```

**Response (201 Created):**

```json
{
  "id": 7,
  "userId": 1,
  "accountName": "Business Current Account",
  "accountNumber": "12345678",
  "sortCode": "12-34-56",
  "openingBalance": 1000.00,
  "currentBalance": 1000.00,
  "createdAt": "2026-01-15T10:00:00Z",
  "updatedAt": "2026-01-15T10:00:00Z"
}
```

**Validation Rules:**

- `accountName`: Required, max: 200 characters
- `accountNumber`: Required, 8 digits
- `sortCode`: Required, format: XX-XX-XX (6 digits with dashes)
- `openingBalance`: Required, decimal

---

### Bank Transactions Endpoints

#### List Bank Transactions

```http
GET /api/v1/bank-accounts/:accountId/transactions
```

**Query Parameters:**

| Parameter  | Type    | Description                     |
|------------|---------|---------------------------------|
| page       | integer | Page number (default: 1)        |
| limit      | integer | Items per page (default: 50)    |
| dateFrom   | date    | Filter from date (YYYY-MM-DD)   |
| dateTo     | date    | Filter to date (YYYY-MM-DD)     |
| reconciled | boolean | Filter by reconciliation status |

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": 101,
      "bankAccountId": 7,
      "date": "2026-01-15",
      "description": "Client payment",
      "amount": 600.00,
      "balance": 5000.00,
      "isReconciled": true,
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 120,
    "totalPages": 3
  }
}
```

---

#### Create Bank Transaction

```http
POST /api/v1/bank-accounts/:accountId/transactions
```

**Request Body:**

```json
{
  "date": "2026-01-15",
  "description": "Client payment",
  "amount": 600.00
}
```

**Response (201 Created):**

```json
{
  "id": 101,
  "bankAccountId": 7,
  "date": "2026-01-15",
  "description": "Client payment",
  "amount": 600.00,
  "balance": 5000.00,
  "isReconciled": false,
  "createdAt": "2026-01-15T10:00:00Z"
}
```

---

#### Reconcile Bank Transaction

```http
POST /api/v1/bank-transactions/:id/reconcile
```

**Request Body:**

```json
{
  "transactionId": 123
}
```

**Response (200 OK):**

```json
{
  "id": 1,
  "bankTransactionId": 101,
  "appTransactionId": 123,
  "reconciledAt": "2026-01-15T14:00:00Z"
}
```

---

### Categories Endpoints

#### List Categories

```http
GET /api/v1/categories
```

**Query Parameters:**

| Parameter | Type   | Description                                               |
|-----------|--------|-----------------------------------------------------------|
| type      | string | Filter by type: `income`, `expense`, `asset`, `liability` |
| language  | string | Response language: `en`, `tr` (default: user preference)  |

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": 1,
      "code": "INC001",
      "nameEn": "Sales",
      "nameTr": "Satışlar",
      "name": "Sales",
      "type": "income",
      "isSystem": true
    },
    {
      "id": 2,
      "code": "INC002",
      "nameEn": "Services",
      "nameTr": "Hizmetler",
      "name": "Services",
      "type": "income",
      "isSystem": true
    },
    {
      "id": 10,
      "code": "EXP001",
      "nameEn": "Office Expenses",
      "nameTr": "Ofis Giderleri",
      "name": "Office Expenses",
      "type": "expense",
      "isSystem": true
    }
  ]
}
```

**Note:** `name` field is localized based on `Accept-Language` header or user's preferred language

---

### Reports Endpoints

#### Get Profit & Loss Report

```http
GET /api/v1/reports/profit-loss
```

**Query Parameters:**

| Parameter | Type   | Description                    |
|-----------|--------|--------------------------------|
| dateFrom  | date   | Start date (YYYY-MM-DD)        |
| dateTo    | date   | End date (YYYY-MM-DD)          |
| format    | string | Response format: `json`, `pdf` |

**Response (200 OK):**

```json
{
  "period": {
    "from": "2026-01-01",
    "to": "2026-12-31"
  },
  "income": {
    "categories": [
      {
        "categoryId": 1,
        "categoryName": "Sales",
        "amount": 75000.00
      },
      {
        "categoryId": 2,
        "categoryName": "Services",
        "amount": 15000.00
      }
    ],
    "total": 90000.00
  },
  "expenses": {
    "categories": [
      {
        "categoryId": 10,
        "categoryName": "Office Expenses",
        "amount": 6200.00
      },
      {
        "categoryId": 11,
        "categoryName": "Travel & Subsistence",
        "amount": 4100.00
      }
    ],
    "total": 65000.00
  },
  "netProfit": 25000.00
}
```

---

#### Get Balance Sheet

```http
GET /api/v1/reports/balance-sheet
```

**Query Parameters:**

| Parameter | Type   | Description             |
|-----------|--------|-------------------------|
| date      | date   | As of date (YYYY-MM-DD) |
| format    | string | `json`, `pdf`           |

**Response (200 OK):**

```json
{
  "asOfDate": "2026-12-31",
  "assets": {
    "current": {
      "cash": 5000.00,
      "bankAccounts": 10000.00,
      "total": 15000.00
    },
    "total": 15000.00
  },
  "liabilities": {
    "current": {
      "vatLiability": 1600.00,
      "creditors": 2000.00,
      "total": 3600.00
    },
    "total": 3600.00
  },
  "equity": {
    "capital": 10000.00,
    "retainedEarnings": 1400.00,
    "total": 11400.00
  },
  "totalLiabilitiesAndEquity": 15000.00
}
```

---

#### Get Cash Flow Statement

```http
GET /api/v1/reports/cash-flow
```

**Query Parameters:**

| Parameter | Type   | Description             |
|-----------|--------|-------------------------|
| dateFrom  | date   | Start date (YYYY-MM-DD) |
| dateTo    | date   | End date (YYYY-MM-DD)   |
| format    | string | `json`, `pdf`           |

**Response (200 OK):**

```json
{
  "period": {
    "from": "2026-01-01",
    "to": "2026-12-31"
  },
  "openingBalance": 1000.00,
  "inflows": {
    "categories": [
      {
        "categoryName": "Sales",
        "amount": 75000.00
      }
    ],
    "total": 90000.00
  },
  "outflows": {
    "categories": [
      {
        "categoryName": "Office Expenses",
        "amount": 6200.00
      }
    ],
    "total": 65000.00
  },
  "netCashFlow": 25000.00,
  "closingBalance": 26000.00
}
```

---

#### Get VAT Return Report

```http
GET /api/v1/reports/vat-return
```

**Query Parameters:**

| Parameter   | Type   | Description                    |
|-------------|--------|--------------------------------|
| periodStart | date   | Period start date (YYYY-MM-DD) |
| periodEnd   | date   | Period end date (YYYY-MM-DD)   |
| format      | string | `json`, `pdf`                  |

**Response (200 OK):**

```json
{
  "period": {
    "start": "2026-01-01",
    "end": "2026-03-31"
  },
  "boxes": {
    "box1": 2450.00,
    "box2": 0.00,
    "box3": 2450.00,
    "box4": 850.00,
    "box5": 1600.00,
    "box6": 12250.00,
    "box7": 4250.00,
    "box8": 0.00,
    "box9": 0.00
  },
  "breakdown": {
    "salesTransactions": [
      {
        "id": 123,
        "date": "2026-01-15",
        "description": "Consulting services",
        "net": 500.00,
        "vat": 100.00,
        "gross": 600.00
      }
    ],
    "purchaseTransactions": [
      {
        "id": 124,
        "date": "2026-01-20",
        "description": "Office supplies",
        "net": 100.00,
        "vat": 20.00,
        "gross": 120.00
      }
    ]
  },
  "deadline": "2026-05-07"
}
```

---

### VAT Returns Endpoints

#### List VAT Returns

```http
GET /api/v1/vat-returns
```

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": 3,
      "userId": 1,
      "periodStart": "2026-01-01",
      "periodEnd": "2026-03-31",
      "box1": 2450.00,
      "box2": 0.00,
      "box3": 2450.00,
      "box4": 850.00,
      "box5": 1600.00,
      "box6": 12250.00,
      "box7": 4250.00,
      "box8": 0.00,
      "box9": 0.00,
      "status": "draft",
      "filedAt": null,
      "createdAt": "2026-04-01T00:00:00Z"
    }
  ]
}
```

---

#### Create VAT Return

```http
POST /api/v1/vat-returns
```

**Request Body:**

```json
{
  "periodStart": "2026-01-01",
  "periodEnd": "2026-03-31"
}
```

**Response (201 Created):**

VAT return with auto-calculated boxes based on transactions in the period.

---

#### Update VAT Return Status

```http
PATCH /api/v1/vat-returns/:id/status
```

**Request Body:**

```json
{
  "status": "filed"
}
```

**Valid Status Transitions:**

- `draft` → `filed`
- `filed` → `paid`

**Response (200 OK):**

```json
{
  "id": 3,
  "status": "filed",
  "filedAt": "2026-04-05T10:00:00Z"
}
```

---

### Dashboard Endpoints

#### Get Dashboard Summary

```http
GET /api/v1/dashboard
```

**Response (200 OK):**

```json
{
  "currentPeriod": {
    "dateFrom": "2026-01-01",
    "dateTo": "2026-01-31"
  },
  "summary": {
    "totalIncome": 12000.00,
    "totalExpenses": 8000.00,
    "netProfit": 4000.00,
    "vatLiability": 800.00
  },
  "upcomingDeadlines": [
    {
      "type": "vat_return",
      "description": "VAT Return Q1 2026",
      "dueDate": "2026-05-07",
      "daysRemaining": 15
    },
    {
      "type": "corporation_tax",
      "description": "Corporation Tax Payment",
      "dueDate": "2027-01-01",
      "daysRemaining": 250
    }
  ],
  "recentTransactions": [
    {
      "id": 123,
      "type": "income",
      "date": "2026-01-15",
      "description": "Consulting services",
      "amount": 600.00
    }
  ],
  "recentInvoices": [
    {
      "id": 456,
      "invoiceNumber": "INV-2026-001",
      "customerName": "Client Ltd",
      "total": 600.00,
      "status": "sent",
      "dueDate": "2026-02-15"
    }
  ],
  "alerts": [
    {
      "type": "warning",
      "message": "Approaching VAT registration threshold",
      "details": "Annual turnover: £82,000 (threshold: £90,000)"
    }
  ]
}
```

---

### Settings Endpoints

#### Get Settings

```http
GET /api/v1/settings
```

**Response (200 OK):**

```json
{
  "taxSettings": {
    "vatRegistered": true,
    "vatNumber": "GB123456789",
    "taxYearStart": "2025-04-06",
    "fiscalYearEnd": "2026-03-31"
  },
  "invoiceSettings": {
    "nextInvoiceNumber": "INV-2026-012",
    "invoicePrefix": "INV",
    "defaultPaymentTerms": "Net 30",
    "defaultNotes": "Payment due within 30 days"
  },
  "notificationSettings": {
    "emailNotifications": true,
    "vatReturnReminder": true,
    "invoiceOverdueReminder": true
  }
}
```

---

#### Update Settings

```http
PUT /api/v1/settings
```

**Request Body:**

```json
{
  "invoiceSettings": {
    "defaultPaymentTerms": "Net 45"
  }
}
```

**Response (200 OK):** Updated settings object

---

## Webhooks

### Webhook Events

Future enhancement for Phase 2. Will support events like:

- `invoice.created`
- `invoice.paid`
- `vat_return.filed`
- `transaction.created`

---

## Changelog

### Version 1.1 (2026-01-12)

- Updated all field naming to camelCase for consistency
- Confirmed VAT return box naming as box1, box2... box9
- Verified consistency with PRD.md database schema
- Added naming convention documentation

### Version 1.0 (2026-01-12)

- Initial API release
- Authentication endpoints
- CRUD operations for all core resources
- Report generation endpoints
- Dashboard summary endpoint

---

**End of API Documentation**
