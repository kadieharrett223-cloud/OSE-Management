-- AddPOChangeNotifications
CREATE TABLE "po_change_notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "po_id" TEXT NOT NULL,
    "po_number" TEXT NOT NULL,
    "changed_by" TEXT,
    "changes" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "po_change_notifications_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders" ("id") ON DELETE CASCADE
);

-- AddIndexes
CREATE INDEX "po_change_notifications_po_id_idx" ON "po_change_notifications"("po_id");
CREATE INDEX "po_change_notifications_created_at_idx" ON "po_change_notifications"("created_at");
