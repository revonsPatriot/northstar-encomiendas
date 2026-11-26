import 'dotenv/config';
import {
  PaymentMoment,
  PaymentType,
  PrismaClient,
  ShipmentStatus,
  UserRole,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set before running the Prisma seed.');
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando carga de datos iniciales para Transportadora NORTHSTAR...');

  const cbba = await prisma.branch.upsert({
    where: { code: 'CBBA' },
    update: {},
    create: {
      code: 'CBBA',
      name: 'Of. CBBA Central',
      department: 'Cochabamba',
      address: '6 de Agosto acera Sur, casi Cabildo',
      phones: '62745735 - 79379473',
      isOwnOffice: true,
    },
  });

  const scz = await prisma.branch.upsert({
    where: { code: 'SCZ' },
    update: {},
    create: {
      code: 'SCZ',
      name: 'Of. Santa Cruz',
      department: 'Santa Cruz',
      address: 'Barrio Estación Argentina Av. 3 pasos al frente entre 3ro y 4to Anillo',
      phones: '62746967',
      isOwnOffice: true,
    },
  });

  const eal = await prisma.branch.upsert({
    where: { code: 'EAL' },
    update: {},
    create: {
      code: 'EAL',
      name: 'Of. El Alto',
      department: 'La Paz',
      address: 'Av. Héroes Km. 7 calle 6 (ex terminal)',
      phones: '62746549',
      isOwnOffice: true,
    },
  });

  const lpz = await prisma.branch.upsert({
    where: { code: 'LPZ' },
    update: {},
    create: {
      code: 'LPZ',
      name: 'Of. La Paz',
      department: 'La Paz',
      address: 'Teniente Oquendo Nro. 414 entre Beni y Larecaja',
      phones: '62745819',
      isOwnOffice: true,
    },
  });

  const oru = await prisma.branch.upsert({
    where: { code: 'ORU' },
    update: {},
    create: {
      code: 'ORU',
      name: 'Of. Oruro',
      department: 'Oruro',
      address: 'Terminal Interdepartamental Oruro',
      phones: '62745900',
      isOwnOffice: true,
    },
  });

  // 2. Rutas interdepartamentales y tarifas reales
  const routeDefs = [
    { origin: cbba, dest: scz, basePrice: 35, pricePerKg: 2.5, hours: 10 },
    { origin: scz, dest: cbba, basePrice: 35, pricePerKg: 2.5, hours: 10 },
    { origin: cbba, dest: lpz, basePrice: 30, pricePerKg: 2.0, hours: 8 },
    { origin: lpz, dest: cbba, basePrice: 30, pricePerKg: 2.0, hours: 8 },
    { origin: cbba, dest: eal, basePrice: 28, pricePerKg: 2.0, hours: 7 },
    { origin: eal, dest: cbba, basePrice: 28, pricePerKg: 2.0, hours: 7 },
    { origin: cbba, dest: oru, basePrice: 25, pricePerKg: 1.5, hours: 4 },
    { origin: oru, dest: cbba, basePrice: 25, pricePerKg: 1.5, hours: 4 },
    { origin: scz, dest: lpz, basePrice: 50, pricePerKg: 3.5, hours: 16 },
    { origin: lpz, dest: scz, basePrice: 50, pricePerKg: 3.5, hours: 16 },
    { origin: lpz, dest: oru, basePrice: 25, pricePerKg: 1.5, hours: 3 },
    { origin: oru, dest: lpz, basePrice: 25, pricePerKg: 1.5, hours: 3 },
  ];

  for (const r of routeDefs) {
    await prisma.route.upsert({
      where: {
        originBranchId_destinationBranchId: {
          originBranchId: r.origin.id,
          destinationBranchId: r.dest.id,
        },
      },
      update: {},
      create: {
        originBranchId: r.origin.id,
        destinationBranchId: r.dest.id,
        basePrice: r.basePrice,
        pricePerKg: r.pricePerKg,
        estimatedHours: r.hours,
        isActive: true,
      },
    });
  }

  // 3. Usuarios por rol y sucursal (Contraseña por defecto: Northstar2026*)
  const defaultPasswordHash = await bcrypt.hash('Northstar2026*', 10);

  const adminCbba = await prisma.user.upsert({
    where: { ci: '1000001' },
    update: {},
    create: {
      branchId: cbba.id,
      fullName: 'Administrador Central CBBA',
      ci: '1000001',
      role: UserRole.ADMIN_CENTRAL,
      passwordHash: defaultPasswordHash,
    },
  });

  await prisma.user.upsert({
    where: { ci: '1500001' },
    update: {},
    create: {
      branchId: scz.id,
      fullName: 'Encargado Sucursal Santa Cruz',
      ci: '1500001',
      role: UserRole.ENCARGADO_SUCURSAL,
      passwordHash: defaultPasswordHash,
    },
  });

  const operadorOruro = await prisma.user.upsert({
    where: { ci: '2000002' },
    update: {},
    create: {
      branchId: oru.id,
      fullName: 'Operador Ventanilla Oruro',
      ci: '2000002',
      role: UserRole.OPERADOR,
      passwordHash: defaultPasswordHash,
    },
  });

  // 4. Clientes particulares y corporativos
  const remitente = await prisma.customer.upsert({
    where: { ciNit: '4512890' },
    update: {},
    create: {
      ciNit: '4512890',
      fullName: 'Nicolas Marquina',
      phone: '70712345',
    },
  });

  const consignatario = await prisma.customer.upsert({
    where: { ciNit: '5289412' },
    update: {},
    create: {
      ciNit: '5289412',
      fullName: 'Monica Flores',
      phone: '72498797',
    },
  });

  const corpCliente = await prisma.customer.upsert({
    where: { ciNit: '1020304022' },
    update: {},
    create: {
      ciNit: '1020304022',
      fullName: 'Importadora Andina S.R.L.',
      phone: '44501122',
      isCorporateAccount: true,
      corporateCreditLimit: 25000.0,
    },
  });

  // 5. Guías iniciales reales en distintos estados
  const existingGuide = await prisma.shipment.findUnique({
    where: { guideNumber: '004154' },
  });

  if (!existingGuide) {
    await prisma.shipment.create({
      data: {
        guideNumber: '004154',
        originBranchId: cbba.id,
        destinationBranchId: oru.id,
        senderId: remitente.id,
        consigneeId: consignatario.id,
        status: ShipmentStatus.EN_SUCURSAL_DESTINO,
        paymentType: PaymentType.POR_PAGAR,
        isPaid: false,
        totalAmount: 1470.0,
        dispatchedByUserId: adminCbba.id,
        arrivedAt: new Date(),
        items: {
          create: [
            {
              quantity: 12,
              description: 'Cajas + 1 maleta',
              weightKg: 85,
              subtotal: 1470.0,
            },
          ],
        },
        statusLogs: {
          create: [
            {
              previousStatus: null,
              newStatus: ShipmentStatus.REGISTRADO,
              changedByUserId: adminCbba.id,
              branchId: cbba.id,
              remarks: 'Registro inicial en ventanilla Cochabamba',
            },
            {
              previousStatus: ShipmentStatus.REGISTRADO,
              newStatus: ShipmentStatus.EN_SUCURSAL_DESTINO,
              changedByUserId: operadorOruro.id,
              branchId: oru.id,
              remarks: 'Arribo confirmado a sucursal Oruro - Pendiente de cobro POR PAGAR',
            },
          ],
        },
      },
    });
  }

  const guide4155 = await prisma.shipment.findUnique({
    where: { guideNumber: '004155' },
  });

  if (!guide4155) {
    const created = await prisma.shipment.create({
      data: {
        guideNumber: '004155',
        originBranchId: cbba.id,
        destinationBranchId: scz.id,
        senderId: corpCliente.id,
        consigneeId: consignatario.id,
        status: ShipmentStatus.EN_TRANSITO,
        paymentType: PaymentType.PAGADO_ORIGEN,
        isPaid: true,
        totalAmount: 185.0,
        dispatchedByUserId: adminCbba.id,
        items: {
          create: [
            {
              quantity: 3,
              description: 'Cajas de repuestos industriales',
              weightKg: 60,
              subtotal: 185.0,
            },
          ],
        },
        statusLogs: {
          create: [
            {
              previousStatus: null,
              newStatus: ShipmentStatus.REGISTRADO,
              changedByUserId: adminCbba.id,
              branchId: cbba.id,
              remarks: 'Registro inicial en ventanilla Cochabamba',
            },
            {
              previousStatus: ShipmentStatus.REGISTRADO,
              newStatus: ShipmentStatus.EN_TRANSITO,
              changedByUserId: adminCbba.id,
              branchId: cbba.id,
              remarks: 'Encomienda despachada desde la sucursal de origen.',
            },
          ],
        },
      },
    });

    await prisma.payment.create({
      data: {
        shipmentId: created.id,
        branchId: cbba.id,
        userId: adminCbba.id,
        amount: 185.0,
        moment: PaymentMoment.ORIGEN,
      },
    });
  }

  console.log('Seed completado: Sucursales, rutas, usuarios, clientes y guías creados.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
