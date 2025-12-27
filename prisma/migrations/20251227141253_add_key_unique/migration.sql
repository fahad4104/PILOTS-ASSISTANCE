/*
  Warnings:

  - Added the required column `key` to the `Manual` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Manual" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "blobPathname" TEXT NOT NULL,
    "openaiFileId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Manual" ("blobPathname", "blobUrl", "createdAt", "id", "openaiFileId", "originalName") SELECT "blobPathname", "blobUrl", "createdAt", "id", "openaiFileId", "originalName" FROM "Manual";
DROP TABLE "Manual";
ALTER TABLE "new_Manual" RENAME TO "Manual";
CREATE UNIQUE INDEX "Manual_key_key" ON "Manual"("key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
