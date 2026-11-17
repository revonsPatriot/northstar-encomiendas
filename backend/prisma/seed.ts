import 'dotenv/config';
import { PrismaClient, UserRole, PaymentType, ShipmentStatus } from '@prisma/client';
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
      phones: '',
      isOwnOffice: true,
    },
  });

  // 2. Crear Usuarios Operadores por Sucursal (Contraseña por defecto: Northstar2026*)
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

  // 3. Clientes de Ejemplo (del recibo físico N° 004154)
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

  // 4. Guía de Ejemplo N° 004154 (Cochabamba -> Oruro, POR PAGAR, 1470 Bs)
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
        items: {
          create: [
            {
              quantity: 12,
              description: 'Cajas + 1 maleta',
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

  console.log('Seed completado: Sucursales, usuarios y guía 004154 creados.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });