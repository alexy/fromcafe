-- CreateEnum
CREATE TYPE "NamingDecisionSource" AS ENUM ('TITLE', 'EXIF_DATE', 'POST_DATE', 'CONTENT_HASH', 'ORIGINAL_FILENAME');

-- CreateTable
CREATE TABLE "image_naming_decisions" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "original_hash" TEXT NOT NULL,
    "blob_filename" TEXT NOT NULL,
    "blob_url" TEXT NOT NULL,
    "naming_source" "NamingDecisionSource" NOT NULL,
    "original_title" TEXT,
    "extracted_date" TEXT,
    "exif_metadata" JSONB,
    "original_filename" TEXT,
    "decision_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_naming_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "image_naming_decisions_original_hash_key" ON "image_naming_decisions"("original_hash");

-- CreateIndex
CREATE INDEX "image_naming_decisions_post_id_idx" ON "image_naming_decisions"("post_id");

-- CreateIndex
CREATE INDEX "image_naming_decisions_blob_filename_idx" ON "image_naming_decisions"("blob_filename");

-- AddForeignKey
ALTER TABLE "image_naming_decisions" ADD CONSTRAINT "image_naming_decisions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;