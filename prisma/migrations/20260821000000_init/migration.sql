-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SALES');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ChannelCapability" AS ENUM ('WECHAT', 'WHATSAPP', 'PHONE', 'EMAIL');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('META', 'TIKTOK', 'MANUAL');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('INDUSTRIAL_PLANT', 'WAREHOUSE', 'STEEL_BUILDING', 'OTHER');

-- CreateEnum
CREATE TYPE "PurchaseTimeline" AS ENUM ('WITHIN_1_MONTH', 'ONE_TO_THREE_MONTHS', 'THREE_TO_SIX_MONTHS', 'OVER_SIX_MONTHS', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AssignmentState" AS ENUM ('UNASSIGNED', 'ASSIGNED', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "ContactAvailability" AS ENUM ('AVAILABLE', 'PARTIAL', 'NONE', 'INVALID');

-- CreateEnum
CREATE TYPE "LeadQualityFlag" AS ENUM ('NORMAL', 'NO_CONTACT', 'INCOMPLETE_CONTACT', 'SUSPECTED_SPAM', 'POSSIBLE_DUPLICATE', 'CONFIRMED_INVALID');

-- CreateEnum
CREATE TYPE "InvalidReason" AS ENUM ('SPAM', 'FAKE_INFORMATION', 'NO_CONTACT_INFORMATION', 'INVALID_CONTACT_INFORMATION', 'DUPLICATE', 'WRONG_INDUSTRY', 'NO_PURCHASE_INTENT', 'TEST_SUBMISSION', 'OTHER');

-- CreateEnum
CREATE TYPE "TagScope" AS ENUM ('PERSONAL', 'SHARED');

-- CreateEnum
CREATE TYPE "CommunicationMethod" AS ENUM ('WECHAT', 'WHATSAPP', 'PHONE', 'EMAIL', 'REVIEW');

-- CreateEnum
CREATE TYPE "AssignmentMethod" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('META', 'TIKTOK');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'IGNORED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "mobile" VARCHAR(32) NOT NULL,
    "email" VARCHAR(255),
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "channel_capabilities" "ChannelCapability"[] DEFAULT ARRAY[]::"ChannelCapability"[],
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_statuses" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_zh" VARCHAR(50) NOT NULL,
    "color" VARCHAR(20) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_terminal" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "lead_number" VARCHAR(32) NOT NULL,
    "name" VARCHAR(200),
    "country_code" VARCHAR(2),
    "country_name" VARCHAR(100),
    "city" VARCHAR(100),
    "company_name" VARCHAR(200),
    "job_title" VARCHAR(150),
    "wechat_id" VARCHAR(100),
    "whatsapp_raw" VARCHAR(100),
    "whatsapp_normalized" VARCHAR(32),
    "phone_raw" VARCHAR(100),
    "phone_normalized" VARCHAR(32),
    "email" VARCHAR(255),
    "email_normalized" VARCHAR(255),
    "preferred_channel" "CommunicationMethod",
    "contact_availability" "ContactAvailability" NOT NULL DEFAULT 'NONE',
    "project_type" "ProjectType",
    "project_description" TEXT,
    "purchase_timeline" "PurchaseTimeline",
    "expected_purchase_date" DATE,
    "estimated_budget" DECIMAL(18,2),
    "budget_currency" VARCHAR(3),
    "remark" TEXT,
    "source_type" "LeadSource" NOT NULL,
    "current_status_id" UUID NOT NULL,
    "assigned_user_id" UUID,
    "assignment_state" "AssignmentState" NOT NULL DEFAULT 'UNASSIGNED',
    "quality_flag" "LeadQualityFlag" NOT NULL DEFAULT 'NORMAL',
    "quality_score" INTEGER,
    "requires_review" BOOLEAN NOT NULL DEFAULT false,
    "invalid_reason_code" "InvalidReason",
    "invalid_reason_note" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "first_contacted_at" TIMESTAMP(3),
    "last_followed_up_at" TIMESTAMP(3),
    "next_follow_up_at" TIMESTAMP(3),
    "won_at" TIMESTAMP(3),
    "lost_reason" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_attributions" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "platform" "LeadSource" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "external_lead_id" VARCHAR(150),
    "campaign_id" VARCHAR(150),
    "campaign_name" VARCHAR(255),
    "adset_id" VARCHAR(150),
    "adset_name" VARCHAR(255),
    "ad_id" VARCHAR(150),
    "ad_name" VARCHAR(255),
    "form_id" VARCHAR(150),
    "form_name" VARCHAR(255),
    "external_created_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_event_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_attributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_up_records" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "followed_up_at" TIMESTAMP(3) NOT NULL,
    "communication_method" "CommunicationMethod" NOT NULL,
    "content" TEXT NOT NULL,
    "next_follow_up_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_up_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_status_histories" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "from_status_id" UUID,
    "to_status_id" UUID NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "change_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_status_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_assignments" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "from_user_id" UUID,
    "to_user_id" UUID NOT NULL,
    "assignment_method" "AssignmentMethod" NOT NULL,
    "assignment_reason" TEXT,
    "assigned_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "color" VARCHAR(20) NOT NULL DEFAULT '#64748B',
    "scope" "TagScope" NOT NULL DEFAULT 'PERSONAL',
    "created_by_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_tags" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "tagged_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_events" (
    "id" UUID NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "external_event_id" VARCHAR(200),
    "external_lead_id" VARCHAR(150),
    "raw_payload" JSONB NOT NULL,
    "signature_valid" BOOLEAN NOT NULL DEFAULT false,
    "processing_status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "integration_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "device_info" VARCHAR(500),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(100),
    "before_data" JSONB,
    "after_data" JSONB,
    "ip_address" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_mobile_key" ON "users"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "lead_statuses_code_key" ON "lead_statuses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "leads_lead_number_key" ON "leads"("lead_number");

-- CreateIndex
CREATE INDEX "leads_assigned_user_id_current_status_id_idx" ON "leads"("assigned_user_id", "current_status_id");

-- CreateIndex
CREATE INDEX "leads_source_type_created_at_idx" ON "leads"("source_type", "created_at");

-- CreateIndex
CREATE INDEX "leads_country_code_idx" ON "leads"("country_code");

-- CreateIndex
CREATE INDEX "leads_next_follow_up_at_idx" ON "leads"("next_follow_up_at");

-- CreateIndex
CREATE INDEX "leads_quality_flag_requires_review_idx" ON "leads"("quality_flag", "requires_review");

-- CreateIndex
CREATE INDEX "leads_phone_normalized_idx" ON "leads"("phone_normalized");

-- CreateIndex
CREATE INDEX "leads_whatsapp_normalized_idx" ON "leads"("whatsapp_normalized");

-- CreateIndex
CREATE INDEX "leads_email_normalized_idx" ON "leads"("email_normalized");

-- CreateIndex
CREATE INDEX "lead_attributions_campaign_id_idx" ON "lead_attributions"("campaign_id");

-- CreateIndex
CREATE INDEX "lead_attributions_campaign_name_idx" ON "lead_attributions"("campaign_name");

-- CreateIndex
CREATE INDEX "lead_attributions_adset_id_idx" ON "lead_attributions"("adset_id");

-- CreateIndex
CREATE INDEX "lead_attributions_ad_id_idx" ON "lead_attributions"("ad_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_attributions_platform_external_lead_id_key" ON "lead_attributions"("platform", "external_lead_id");

-- CreateIndex
CREATE INDEX "follow_up_records_lead_id_followed_up_at_idx" ON "follow_up_records"("lead_id", "followed_up_at");

-- CreateIndex
CREATE INDEX "follow_up_records_user_id_next_follow_up_at_idx" ON "follow_up_records"("user_id", "next_follow_up_at");

-- CreateIndex
CREATE INDEX "lead_status_histories_lead_id_created_at_idx" ON "lead_status_histories"("lead_id", "created_at");

-- CreateIndex
CREATE INDEX "lead_assignments_lead_id_created_at_idx" ON "lead_assignments"("lead_id", "created_at");

-- CreateIndex
CREATE INDEX "tags_scope_is_active_idx" ON "tags"("scope", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "tags_created_by_id_scope_name_key" ON "tags"("created_by_id", "scope", "name");

-- CreateIndex
CREATE INDEX "lead_tags_tag_id_idx" ON "lead_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_tags_lead_id_tag_id_key" ON "lead_tags"("lead_id", "tag_id");

-- CreateIndex
CREATE INDEX "integration_events_provider_processing_status_received_at_idx" ON "integration_events"("provider", "processing_status", "received_at");

-- CreateIndex
CREATE INDEX "integration_events_external_lead_id_idx" ON "integration_events"("external_lead_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_revoked_at_idx" ON "refresh_tokens"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_current_status_id_fkey" FOREIGN KEY ("current_status_id") REFERENCES "lead_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_attributions" ADD CONSTRAINT "lead_attributions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_attributions" ADD CONSTRAINT "lead_attributions_raw_event_id_fkey" FOREIGN KEY ("raw_event_id") REFERENCES "integration_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_records" ADD CONSTRAINT "follow_up_records_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_records" ADD CONSTRAINT "follow_up_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_histories" ADD CONSTRAINT "lead_status_histories_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_histories" ADD CONSTRAINT "lead_status_histories_from_status_id_fkey" FOREIGN KEY ("from_status_id") REFERENCES "lead_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_histories" ADD CONSTRAINT "lead_status_histories_to_status_id_fkey" FOREIGN KEY ("to_status_id") REFERENCES "lead_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_histories" ADD CONSTRAINT "lead_status_histories_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_tags" ADD CONSTRAINT "lead_tags_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_tags" ADD CONSTRAINT "lead_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_tags" ADD CONSTRAINT "lead_tags_tagged_by_id_fkey" FOREIGN KEY ("tagged_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
