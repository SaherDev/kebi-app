import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  ValidateNested,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Max prose length accepted per curation (kebi structures it into claims). */
const MAX_CURATE_TEXT = 8000;

/**
 * Enforces the contract's "exactly one of place_id / area_id" rule. kebi 422s on
 * both-or-neither; rejecting it here turns that into an actionable 400 at our
 * edge instead of a round-trip — the same reason `home_country` is validated
 * before it can become a kebi 422 (ADR-042).
 *
 * Declared on the **parent's** `anchor` property rather than inside
 * {@link CurateAnchorDto}. A marker property on the anchor itself would need a
 * validation decorator to be evaluated, and `whitelist: true` keeps any decorated
 * property — so the marker would ride through to kebi as an unknown field.
 */
@ValidatorConstraint({ name: 'exactlyOneAnchorId' })
export class ExactlyOneAnchorId implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    // Absence is @IsOptional's business — unanchored prose is legal.
    if (value === undefined || value === null) return true;
    const anchor = value as CurateAnchorDto;
    return (anchor.place_id === undefined) !== (anchor.area_id === undefined);
  }

  defaultMessage(): string {
    return 'anchor must carry exactly one of place_id or area_id';
  }
}

/**
 * What the prose is about (ADR-160). A **venue anchor is what makes
 * `place`-scoped claims expressible** — unanchored prose stays geo-scoped — so
 * an omitted anchor is not merely less precise, it changes what kebi can store.
 *
 * `area_id` is the **encoded token** off a `kebi://area/{id}` link, never an
 * area's raw geo key: the key is a slash path no endpoint accepts, so sending it
 * 404s. The exactly-one rule lives on the parent (see {@link ExactlyOneAnchorId});
 * these two are the only declared properties, so `whitelist: true` strips
 * everything else before the body is forwarded.
 */
export class CurateAnchorDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  place_id?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  area_id?: string;
}

/**
 * Client→gateway curation body (ADR-121, anchors ADR-160). Identity travels in
 * the X-Gateway-User-Id header; the curator role is not a body field — the
 * gateway sources it from the token claim and forwards X-Gateway-Can-Curate.
 *
 * `location_hint` was removed when anchors landed: an area anchor is the same
 * fallback geography, verified.
 */
export class CurateKnowledgeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_CURATE_TEXT)
  text!: string;

  @IsOptional()
  @ValidateNested()
  @Validate(ExactlyOneAnchorId)
  @Type(() => CurateAnchorDto)
  anchor?: CurateAnchorDto;
}
