-- CreateTable
CREATE TABLE "thoughts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thoughts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thought_versions" (
    "id" TEXT NOT NULL,
    "thoughtId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiSummary" TEXT,
    "aiTags" TEXT[],

    CONSTRAINT "thought_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thought_diffs" (
    "id" TEXT NOT NULL,
    "fromVersionId" TEXT NOT NULL,
    "toVersionId" TEXT NOT NULL,
    "addedWords" TEXT[],
    "removedWords" TEXT[],
    "metrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thought_diffs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "thought_versions" ADD CONSTRAINT "thought_versions_thoughtId_fkey" FOREIGN KEY ("thoughtId") REFERENCES "thoughts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thought_diffs" ADD CONSTRAINT "thought_diffs_fromVersionId_fkey" FOREIGN KEY ("fromVersionId") REFERENCES "thought_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thought_diffs" ADD CONSTRAINT "thought_diffs_toVersionId_fkey" FOREIGN KEY ("toVersionId") REFERENCES "thought_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
