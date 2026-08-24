import { ProjectType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export type AssignmentMode = 'round_robin' | 'load_balance' | 'rule_based';
export type AssignmentRuleType = 'country' | 'project_type';

export class AssignmentRuleDto {
  @IsIn(['country', 'project_type'])
  type: AssignmentRuleType;

  @ValidateIf((rule: AssignmentRuleDto) => rule.type === 'country')
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Length(2, 2, { each: true })
  countries?: string[];

  @ValidateIf((rule: AssignmentRuleDto) => rule.type === 'project_type')
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(Object.values(ProjectType), { each: true })
  projectTypes?: ProjectType[];

  @IsUUID()
  userId: string;
}

export class AssignmentConfigDto {
  @IsBoolean()
  enabled: boolean;

  @IsIn(['round_robin', 'load_balance', 'rule_based'])
  mode: AssignmentMode;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignmentRuleDto)
  rules: AssignmentRuleDto[];

  @IsOptional()
  @IsUUID()
  defaultUserId?: string;

  @IsInt()
  @Min(0)
  roundRobinIndex: number;
}
