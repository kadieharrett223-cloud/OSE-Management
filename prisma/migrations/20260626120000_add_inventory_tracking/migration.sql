-- Create inventory tables for simple inventory tracker
CREATE TABLE "InventoryProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "onFloor" INTEGER NOT NULL DEFAULT 0,
    "sold" INTEGER NOT NULL DEFAULT 0,
    "available" INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX "InventoryProduct_name_key" ON "InventoryProduct"("name");

CREATE TABLE "InventoryOrderEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "productId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    CONSTRAINT "InventoryOrderEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "InventoryOrderEntry_productId_idx" ON "InventoryOrderEntry"("productId");
