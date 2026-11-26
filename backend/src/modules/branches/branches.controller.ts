import { Controller, Get } from '@nestjs/common';
import { BranchesService } from './branches.service';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  list() {
    return this.branchesService.listActiveBranches();
  }

  @Get('routes')
  listActiveRoutes() {
    return this.branchesService.listActiveRoutes();
  }

  @Get('overview')
  getPublicOverview() {
    return this.branchesService.getPublicOverview();
  }
}
