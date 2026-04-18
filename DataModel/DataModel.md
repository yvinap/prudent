# Prudent — Data Model

Prudent is a personal expense tracking application. Data is stored in S3 using a structured folder hierarchy. All records use ISO 8601 timestamps (`YYYY-MM-DDTHH:mm:ssZ`) and GUIDs for IDs.

> **Cost optimisation (Option A):** Reference data (things, tags, categories, budgets) is stored as a single aggregated JSON array per account rather than one file per record. Transactions and audit logs are aggregated into one file per day. This dramatically reduces S3 API calls — loading a month of transactions costs 30 GETs instead of hundreds — while keeping the architecture entirely within S3.

---

## S3 Folder Structure

```
s3://prudent-data/
├── Metadata/
│   ├── users/
│   │   └── {userId}.json            ← one file per user (unchanged)
│   └── accounts/
│       └── {accountId}.json          ← one file per account (unchanged)
│       └── {accountId}/
│           ├── things.json           ← ALL things for the account in one file
│           ├── tags.json             ← ALL tags for the account in one file
           ├── categories.json       ← ALL categories for the account in one file
           └── budgets.json          ← ALL budgets for the account in one file
├── Transactions/
│   └── {accountId}/
│       └── {year}/
│           └── {month}/
│               └── {date}.json       ← ALL transactions for the day in one file
├── Receipts/
│   └── {accountId}/
│       └── {year}/
│           └── {month}/
│               └── {receiptId}.json  ← one file per receipt (unchanged)
│               └── {receiptId}/
│                   └── lineItems.json ← ALL line items for the receipt in one file
└── AuditLogs/
    └── {userId}/
        └── {year}/
            └── {month}/
                └── {date}.json       ← ALL audit log entries for the day in one file
```

---

## Entities

### User
**Path:** `Metadata/users/{userId}.json`

Represents an individual who can log in and access one or more accounts.

```json
{
  "id": "guid",
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-01T00:00:00Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | GUID | Unique identifier |
| `firstName` | string | User's first name |
| `lastName` | string | User's last name |
| `email` | string | Unique email address used for login |
| `createdAt` | ISO 8601 | Record creation timestamp |
| `updatedAt` | ISO 8601 | Last update timestamp |

---

### Account
**Path:** `Metadata/accounts/{accountId}.json`

An account groups users and their transactions. An account can be shared by multiple users. One user is the primary owner; others are secondary owners.

```json
{
  "id": "guid",
  "name": "Smith Family Budget",
  "primaryOwner": "user-guid",
  "secondaryOwners": ["user-guid"],
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-01T00:00:00Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | GUID | Unique identifier |
| `name` | string | Human-readable account name |
| `primaryOwner` | GUID | User ID of the primary account owner |
| `secondaryOwners` | GUID[] | User IDs of additional account members |
| `createdAt` | ISO 8601 | Record creation timestamp |
| `updatedAt` | ISO 8601 | Last update timestamp |

---

### Thing
**Path:** `Metadata/accounts/{accountId}/things.json`

Represents a purchasable product or good that can be referenced in transactions. All things for an account are stored together in a single JSON array. To add or update a thing, GET the file, modify the array, then PUT it back.

```json
[
  {
    "id": "guid",
    "accountId": "guid",
    "name": "Whole Milk",
    "defaultCategoryId": "guid",
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z"
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | GUID | Unique identifier |
| `accountId` | GUID | Account this thing belongs to |
| `name` | string | Thing name |
| `defaultCategoryId` | GUID | Optional default category pre-filled when this thing is selected in a transaction |
| `createdAt` | ISO 8601 | Record creation timestamp |
| `updatedAt` | ISO 8601 | Last update timestamp |

---

### Tag
**Path:** `Metadata/accounts/{accountId}/tags.json`

A free-form label that can be applied to one or more transactions for secondary filtering (e.g. "reimbursable", "work trip"). All tags for an account are stored together in a single JSON array. To add or update a tag, GET the file, modify the array, then PUT it back.

```json
[
  {
    "id": "guid",
    "accountId": "guid",
    "name": "reimbursable",
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z"
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | GUID | Unique identifier |
| `accountId` | GUID | Account this tag belongs to |
| `name` | string | Tag label |
| `createdAt` | ISO 8601 | Record creation timestamp |
| `updatedAt` | ISO 8601 | Last update timestamp |

---

### Category
**Path:** `Metadata/accounts/{accountId}/categories.json`

The primary classification of a transaction. Every transaction has exactly one category. Categories are scoped to an account and carry display metadata (icon and colour) for use in charts and the UI. A default set is created when an account is first set up; users may add custom categories. All categories for an account are stored together in a single JSON array.

```json
[
  {
    "id": "guid",
    "accountId": "guid",
    "name": "Food",
    "icon": "🍔",
    "color": "#f97316",
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z"
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | GUID | Unique identifier |
| `accountId` | GUID | Account this category belongs to |
| `name` | string | Category name |
| `icon` | string | Emoji or icon identifier for UI display |
| `color` | string | Hex colour code for charts and badges |
| `createdAt` | ISO 8601 | Record creation timestamp |
| `updatedAt` | ISO 8601 | Last update timestamp |

---

### Transaction
**Path:** `Transactions/{accountId}/{year}/{month}/{date}.json`

All transactions for a given day are stored together in a single JSON array. To add or update a transaction, GET the day file, modify the array, then PUT it back. For a personal expense tracker the write volume per day is low, making this read-modify-write pattern acceptable.

```json
[
  {
    "id": "guid",
    "accountId": "guid",
    "createdBy": "user-guid",
    "thingId": "guid",
    "categoryId": "guid",
    "tagIds": ["guid", "guid"],
    "qty": 1,
    "price": 10.00,
    "currency": "USD",
    "receiptId": "guid",
    "receiptLineItemId": "guid",
    "createdAt": "2026-01-02T10:00:00Z",
    "updatedAt": "2026-01-02T10:00:00Z"
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | GUID | Unique identifier |
| `accountId` | GUID | Account this transaction belongs to |
| `createdBy` | GUID | User ID of who recorded the transaction |
| `thingId` | GUID | Reference to the purchased thing |
| `categoryId` | GUID | Primary category for this transaction (required) |
| `tagIds` | GUID[] | Zero or more tag IDs for secondary labelling |
| `qty` | number | Quantity purchased |
| `price` | number | Unit price |
| `currency` | string | ISO 4217 currency code (e.g. `USD`) |
| `receiptId` | GUID | Optional reference to the parent receipt |
| `receiptLineItemId` | GUID | Optional reference to the receipt line item this was resolved from |
| `createdAt` | ISO 8601 | Record creation timestamp |
| `updatedAt` | ISO 8601 | Last update timestamp |

---

### Receipt
**Path:** `Receipts/{accountId}/{year}/{month}/{receiptId}.json`

Tracks a receipt image or document uploaded by a user. A receipt is independent of any single transaction — it produces one or more `ReceiptLineItem` records which are later resolved into individual transactions. The raw file (image/PDF) is stored separately in S3 under a raw receipts prefix.

```json
{
  "id": "guid",
  "accountId": "guid",
  "transactionIds": ["guid", "guid"],
  "s3Key": "receipts/raw/{accountId}/{receiptId}.jpg",
  "uploadedBy": "user-guid",
  "status": "uploaded",
  "createdAt": "2026-01-02T10:00:00Z",
  "updatedAt": "2026-01-02T10:00:00Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | GUID | Unique identifier |
| `accountId` | GUID | Account this receipt belongs to |
| `transactionIds` | GUID[] | Transactions confirmed from this receipt's line items |
| `s3Key` | string | S3 object key of the raw receipt file |
| `uploadedBy` | GUID | User ID of who uploaded the receipt |
| `status` | string | Processing state — see values below |
| `createdAt` | ISO 8601 | Upload timestamp |
| `updatedAt` | ISO 8601 | Last update timestamp |

**Status values:**

| Status | Description |
|--------|-------------|
| `uploaded` | Raw file stored; parsing not yet started |
| `parsing` | OCR / AI extraction in progress |
| `matched` | Line items extracted and awaiting user confirmation |
| `confirmed` | All line items confirmed and transactions created |

---

### ReceiptLineItem
**Path:** `Receipts/{accountId}/{year}/{month}/{receiptId}/lineItems.json`

All parsed lines for a receipt are stored together in a single JSON array alongside the parent receipt. To confirm or update a line item, GET the file, modify the array, then PUT it back.

```json
[
  {
    "id": "guid",
    "receiptId": "guid",
    "accountId": "guid",
    "rawText": "Whole Milk 2x $3.49",
    "resolvedThingId": "guid",
    "resolvedCategoryId": "guid",
    "qty": 2,
    "unitPrice": 3.49,
    "currency": "USD",
    "transactionId": "guid",
    "createdAt": "2026-01-02T10:00:00Z",
    "updatedAt": "2026-01-02T10:00:00Z"
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | GUID | Unique identifier |
| `receiptId` | GUID | Parent receipt |
| `accountId` | GUID | Account this line item belongs to |
| `rawText` | string | Original OCR text for this line |
| `resolvedThingId` | GUID | Matched `Thing` ID — null until resolved |
| `resolvedCategoryId` | GUID | Matched `Category` ID — null until resolved |
| `qty` | number | Parsed quantity |
| `unitPrice` | number | Parsed unit price |
| `currency` | string | ISO 4217 currency code |
| `transactionId` | GUID | Set once the user confirms this line item and a transaction is created |
| `createdAt` | ISO 8601 | Record creation timestamp |
| `updatedAt` | ISO 8601 | Last update timestamp |

---

### Budget
**Path:** `Metadata/accounts/{accountId}/budgets.json`

Defines a spending ceiling or saving floor for a recurring period. A budget is scoped to either a category or a tag — exactly one must be set, the other must be `null`. Category-scoped budgets work best for regular classification (e.g. Food, Transport); tag-scoped budgets work best for cross-category envelopes (e.g. a work-trip or a reimbursable pool). Realized amounts are always computed from transactions at query time — never stored.

```json
[
  {
    "id": "guid",
    "accountId": "guid",
    "name": "Monthly Food",
    "type": "spending",
    "period": "month",
    "amount": 300.00,
    "currency": "USD",
    "categoryId": "guid",
    "tagId": null,
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z"
  }
]
```

| Field | Type | Description |
|-------|------|--------------|
| `id` | GUID | Unique identifier |
| `accountId` | GUID | Account this budget belongs to |
| `name` | string | Human-readable label (e.g. "Monthly Food") |
| `type` | string | `spending` — ceiling not to exceed; `saving` — floor to reach by period end |
| `period` | string | `month` or `year` — budget recurs automatically each period |
| `amount` | number | Target amount |
| `currency` | string | ISO 4217 currency code (e.g. `USD`) |
| `categoryId` | GUID | Category scope — set when budgeting by classification; `null` if tag-scoped |
| `tagId` | GUID | Tag scope — set for cross-category envelopes; `null` if category-scoped |
| `createdAt` | ISO 8601 | Record creation timestamp |
| `updatedAt` | ISO 8601 | Last update timestamp |

> **Constraint:** exactly one of `categoryId` or `tagId` must be non-null. Enforced at write time.

**Type behaviour at query time:**

| `type` | Progress bar | Alert fires when… |
|--------|-------------|-------------------|
| `spending` | realized / amount (turns red when ≥ 100%) | realized ≥ amount |
| `saving` | realized / amount (turns green when ≥ 100%) | realized < amount at period end |

---

### Audit Log

All actions performed by a user on a given day are appended into a single JSON array. This is the most write-heavy entity — appending a new entry requires GET + append + PUT. Because audit logs are written infrequently relative to reads, and are rarely queried in real time, this trade-off is acceptable.

```json
[
  {
    "id": "guid",
    "userId": "guid",
    "accountId": "guid",
    "action": "CREATE_TRANSACTION",
    "resourceType": "Transaction",
    "resourceId": "guid",
    "timestamp": "2026-01-02T10:00:00Z",
    "details": {}
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | GUID | Unique identifier |
| `userId` | GUID | User who performed the action |
| `accountId` | GUID | Account the action was performed on |
| `action` | string | Action code — see values below |
| `resourceType` | string | Entity type acted on (e.g. `Transaction`, `Tag`) |
| `resourceId` | GUID | ID of the entity acted on |
| `timestamp` | ISO 8601 | When the action occurred |
| `details` | object | Optional additional context (e.g. diff of changed fields) |

**Action values:**

| Action | Description |
|--------|-------------|
| `CREATE_TRANSACTION` | A new transaction was created |
| `UPDATE_TRANSACTION` | A transaction was modified |
| `DELETE_TRANSACTION` | A transaction was deleted |
| `CREATE_THING` | A new thing was created |
| `UPDATE_THING` | A thing was modified |
| `CREATE_TAG` | A new tag was created |
| `UPDATE_TAG` | A tag was modified |
| `CREATE_CATEGORY` | A new category was created |
| `UPDATE_CATEGORY` | A category was modified |
| `UPLOAD_RECEIPT` | A receipt was uploaded |
| `CONFIRM_RECEIPT_LINE_ITEM` | A receipt line item was confirmed and a transaction created |
| `CREATE_BUDGET` | A new budget was created |
| `UPDATE_BUDGET` | A budget was modified |
| `DELETE_BUDGET` | A budget was deleted |

---

## Relationships

```
User ──< Account >── User
   (primaryOwner / secondaryOwners)

Account ──< Thing
Account ──< Tag
Account ──< Category
Account ──< Budget
Account ──< Transaction

Transaction >── Thing
Transaction >── Category

Thing >── Category  (defaultCategoryId — nullable, used as UI pre-fill hint)
Transaction >──< Tag        (via tagIds[])
Transaction >── Receipt     (via receiptId)
Transaction >── ReceiptLineItem  (via receiptLineItemId)

Receipt >──< Transaction    (via transactionIds[])
Receipt ──< ReceiptLineItem

ReceiptLineItem >── Thing     (resolvedThingId — nullable)
ReceiptLineItem >── Category  (resolvedCategoryId — nullable)
ReceiptLineItem >── Transaction  (transactionId — nullable until confirmed)

User ──< AuditLog

Budget >── Category  (categoryId — null if tag-scoped)
Budget >── Tag       (tagId — null if category-scoped)
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Aggregated things/tags/categories/budgets per account | All reference data for an account loads in 4 GETs regardless of how many records exist; suitable because this data is small and rarely changes |
| Aggregated transactions per day | Loading a full month costs 28–31 GETs instead of one GET per transaction; personal expense trackers have low daily write volume, making read-modify-write acceptable |
| Aggregated audit logs per day | Write-once append pattern; logs are rarely queried live so read-modify-write cost is acceptable |
| Aggregated line items per receipt | A receipt has a bounded, small number of lines; loading them all in one GET is always correct |
| Year/month/date folder hierarchy | Supports efficient S3 prefix-based queries by time range |
| Tags scoped to account | Prevents tag collisions across unrelated accounts; used for free-form secondary labelling |
| `Thing.defaultCategoryId` as optional hint | Enables the UI to auto-select the most likely category when a thing is chosen, reducing taps per transaction; `Transaction.categoryId` remains the authoritative value and can always be overridden |
| Category as a separate entity from Tag | Transactions need exactly one primary classification with icon/colour for charts; tags remain free-form and multi-value |
| ISO 8601 timestamps | Lexicographically sortable; valid for S3 key ordering |
| `currency` field on Transaction and ReceiptLineItem | Supports multi-currency expense tracking without schema changes |
| Receipt path keyed on `receiptId`, not `transactionId` | One receipt produces many transactions; tying the path to a transaction ID would break the 1-to-many relationship |
| `ReceiptLineItem` as a staging entity | Separates raw OCR output from confirmed transactions; allows partial confirmation and preserves the original parsed text for auditing |
| `status` on Receipt | Allows the pipeline (`uploaded → parsing → matched → confirmed`) to be tracked and resumed without polling S3 |
| `receiptLineItemId` on Transaction | Provides full traceability from a confirmed transaction back to the original OCR line |
| Budget realized amounts computed at query time | Storing a running total would require updating it on every transaction write, creating a consistency risk; summing transactions for the period is always correct and the data volume per period is small |
| Budget scoped to category or tag (not both, not neither) | Category scope covers the common case of classification-based budgeting with complete, unambiguous coverage; tag scope covers cross-category envelopes (e.g. work trips, reimbursables) that span multiple categories — exactly one axis prevents double-counting and undefined behaviour |
| Receipts as separate entity | Decouples file storage lifecycle from transaction records |
