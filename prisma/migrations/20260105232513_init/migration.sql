-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'REP',
    "repId" TEXT,
    CONSTRAINT "User_repId_fkey" FOREIGN KEY ("repId") REFERENCES "Rep" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Rep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "qboRepCode" TEXT NOT NULL,
    "defaultCommissionRate" REAL NOT NULL DEFAULT 0.05,
    "userId" TEXT
);

-- CreateTable
CREATE TABLE "PriceListItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT,
    "currentSalePricePerUnit" REAL NOT NULL,
    "shippingIncludedPerUnit" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "qboInvoiceId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "txnDate" DATETIME NOT NULL,
    "salesRepCode" TEXT NOT NULL,
    "repId" TEXT,
    "totalCommissionable" REAL NOT NULL DEFAULT 0,
    "totalCommission" REAL NOT NULL DEFAULT 0,
    "shippingDeducted" REAL NOT NULL DEFAULT 0,
    "invoiceCountWeight" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Invoice_repId_fkey" FOREIGN KEY ("repId") REFERENCES "Rep" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "salePriceUsed" REAL NOT NULL,
    "shippingIncludedPerUnit" REAL NOT NULL DEFAULT 0,
    "shippingDeductionLine" REAL NOT NULL DEFAULT 0,
    "commissionableLine" REAL NOT NULL DEFAULT 0,
    "commissionLine" REAL NOT NULL DEFAULT 0,
    "mappingStatus" TEXT NOT NULL DEFAULT 'MATCHED',
    "priceListItemId" TEXT,
    CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InvoiceLine_priceListItemId_fkey" FOREIGN KEY ("priceListItemId") REFERENCES "PriceListItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommissionSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "repId" TEXT NOT NULL,
    "totalCommission" REAL NOT NULL DEFAULT 0,
    "totalCommissionable" REAL NOT NULL DEFAULT 0,
    "shippingDeducted" REAL NOT NULL DEFAULT 0,
    "invoiceCount" INTEGER NOT NULL DEFAULT 0,
    "journalEntryId" TEXT,
    "postedAt" DATETIME,
    CONSTRAINT "CommissionSnapshot_repId_fkey" FOREIGN KEY ("repId") REFERENCES "Rep" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "oauth_token_secret" TEXT,
    "oauth_token" TEXT,
    "refresh_token_expires_in" INTEGER,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_repId_key" ON "User"("repId");

-- CreateIndex
CREATE UNIQUE INDEX "Rep_qboRepCode_key" ON "Rep"("qboRepCode");

-- CreateIndex
CREATE UNIQUE INDEX "PriceListItem_sku_key" ON "PriceListItem"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_qboInvoiceId_key" ON "Invoice"("qboInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionSnapshot_repId_year_month_key" ON "CommissionSnapshot"("repId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");
