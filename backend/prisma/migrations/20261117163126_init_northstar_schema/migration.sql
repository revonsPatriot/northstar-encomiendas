-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN_CENTRAL', 'ENCARGADO_SUCURSAL', 'OPERADOR');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('REGISTRADO', 'EN_TRANSITO', 'EN_SUCURSAL_DESTINO', 'ENTREGADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('PAGADO_ORIGEN', 'POR_PAGAR', 'CUENTA_CORPORATIVA');

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phones" TEXT,
    "isOwnOffice" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "ci" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OPERADOR',
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "ciNit" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "isCorporateAccount" BOOLEAN NOT NULL DEFAULT false,
    "corporateCreditLimit" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "guideNumber" TEXT NOT NULL,
    "originBranchId" TEXT NOT NULL,
    "destinationBranchId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "consigneeId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'REGISTRADO',
    "paymentType" "PaymentType" NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "dispatchedByUserId" TEXT NOT NULL,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrivedAt" TIMESTAMP(3),
    "deliveredByUserId" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "receiverCiVerified" TEXT,
    "deliveryNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_items" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "weightKg" DECIMAL(8,2),
    "subtotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_status_logs" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "previousStatus" "ShipmentStatus",
    "newStatus" "ShipmentStatus" NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_ci_key" ON "users"("ci");

-- CreateIndex
CREATE UNIQUE INDEX "customers_ciNit_key" ON "customers"("ciNit");

-- CreateIndex
CREATE INDEX "customers_ciNit_idx" ON "customers"("ciNit");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_guideNumber_key" ON "shipments"("guideNumber");

-- CreateIndex
CREATE INDEX "shipments_destinationBranchId_status_idx" ON "shipments"("destinationBranchId", "status");

-- CreateIndex
CREATE INDEX "shipments_guideNumber_idx" ON "shipments"("guideNumber");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_originBranchId_fkey" FOREIGN KEY ("originBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_destinationBranchId_fkey" FOREIGN KEY ("destinationBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_consigneeId_fkey" FOREIGN KEY ("consigneeId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_dispatchedByUserId_fkey" FOREIGN KEY ("dispatchedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_deliveredByUserId_fkey" FOREIGN KEY ("deliveredByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_status_logs" ADD CONSTRAINT "shipment_status_logs_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_status_logs" ADD CONSTRAINT "shipment_status_logs_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_status_logs" ADD CONSTRAINT "shipment_status_logs_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
