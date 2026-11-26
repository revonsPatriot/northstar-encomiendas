import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import type { ReportPeriod } from '../reports/report-range.util';

export class ReportQueryDto {
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  period?: ReportPeriod;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener el formato AAAA-MM-DD.',
  })
  date?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
