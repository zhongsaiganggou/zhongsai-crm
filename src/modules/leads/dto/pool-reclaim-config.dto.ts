import { ArrayNotEmpty, IsArray, IsBoolean, IsInt, IsString, Max, Min } from 'class-validator';

export class PoolReclaimConfigDto {
  @IsBoolean()
  enabled: boolean;

  @IsInt()
  @Min(1)
  @Max(365)
  reclaimAfterDays: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  excludeStatuses: string[];

  @IsInt()
  @Min(0)
  @Max(30)
  notifyBeforeDays: number;
}
