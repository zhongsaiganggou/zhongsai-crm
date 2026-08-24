-- CreateTable
CREATE TABLE "system_configs" (
    "id" UUID NOT NULL,
    "config_key" VARCHAR(100) NOT NULL,
    "config_value" JSONB NOT NULL,
    "description" VARCHAR(500),
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_config_key_key" ON "system_configs"("config_key");

-- Allow assignment history to represent a lead being returned to the public pool.
ALTER TABLE "lead_assignments" DROP CONSTRAINT "lead_assignments_to_user_id_fkey";
ALTER TABLE "lead_assignments" ALTER COLUMN "to_user_id" DROP NOT NULL;
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_to_user_id_fkey"
FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_configs" ADD CONSTRAINT "system_configs_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
