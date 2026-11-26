import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../auth/infrastructure/guards/jwt-auth.guard';
import { todayInBolivia } from '../cash/date.util';
import { AdminService } from './admin.service';
import { ReportQueryDto } from './dtos/report-query.dto';
import { ReportsService } from './reports/reports.service';
import {
  AdminCustomerDto,
  AdminUpdateShipmentDto,
  CreateBranchDto,
  CreateRouteDto,
  CreateUserDto,
  UpdateBranchDto,
  UpdateRouteDto,
  UpdateUserDto,
} from './dtos/admin.dtos';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_CENTRAL')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly reportsService: ReportsService,
  ) {}

  @Get('overview')
  getOverview() {
    return this.adminService.getOverview();
  }

  // --- REPORTES (DIARIO / SEMANAL / MENSUAL) ---

  @Get('reports')
  getReport(@Query() query: ReportQueryDto) {
    return this.reportsService.getReport(
      query.period ?? 'day',
      query.date ?? todayInBolivia(),
      query.branchId,
    );
  }

  // --- USUARIOS ---

  @Get('users')
  listUsers(@Query('q') query?: string) {
    return this.adminService.listUsers(query);
  }

  @Post('users')
  createUser(@Body() dto: CreateUserDto) {
    return this.adminService.createUser(dto);
  }

  @Patch('users/:id')
  updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.adminService.updateUser(id, dto);
  }

  @Delete('users/:id')
  deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.adminService.deleteUser(id, request.user.userId);
  }

  // --- SUCURSALES ---

  @Get('branches')
  listBranches() {
    return this.adminService.listBranches();
  }

  @Post('branches')
  createBranch(@Body() dto: CreateBranchDto) {
    return this.adminService.createBranch(dto);
  }

  @Patch('branches/:id')
  updateBranch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.adminService.updateBranch(id, dto);
  }

  @Delete('branches/:id')
  deleteBranch(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteBranch(id);
  }

  // --- RUTAS Y TARIFAS ---

  @Get('routes')
  listRoutes() {
    return this.adminService.listRoutes();
  }

  @Post('routes')
  createRoute(@Body() dto: CreateRouteDto) {
    return this.adminService.createRoute(dto);
  }

  @Patch('routes/:id')
  updateRoute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRouteDto,
  ) {
    return this.adminService.updateRoute(id, dto);
  }

  @Delete('routes/:id')
  deleteRoute(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteRoute(id);
  }

  // --- CLIENTES ---

  @Get('customers')
  listCustomers(@Query('q') query?: string) {
    return this.adminService.listCustomers(query);
  }

  @Post('customers')
  createCustomer(@Body() dto: AdminCustomerDto) {
    return this.adminService.createCustomer(dto);
  }

  @Patch('customers/:id')
  updateCustomer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminCustomerDto,
  ) {
    return this.adminService.updateCustomer(id, dto);
  }

  @Delete('customers/:id')
  deleteCustomer(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteCustomer(id);
  }

  // --- ENCOMIENDAS (CONTROL GLOBAL) ---

  @Get('shipments')
  listShipments(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
    @Query('paymentType') paymentType?: string,
  ) {
    return this.adminService.listShipments({ q, status, branchId, paymentType });
  }

  @Patch('shipments/:id')
  updateShipment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateShipmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.adminService.updateShipment(id, dto, request.user);
  }

  @Delete('shipments/:id')
  deleteShipment(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteShipment(id);
  }
}
