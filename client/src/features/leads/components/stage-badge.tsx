import type { PipelineStageDto } from '@leadpilot/shared';
import { cn } from '@/lib/utils';

/**
 * Stage pill coloured from the stage row's own hex value.
 *
 * The colour comes from the database rather than a hard-coded map so a tenant
 * that recolours its pipeline (Phase 2) is reflected everywhere at once. Colour
 * is applied at low alpha with matching text so contrast holds in both themes.
 */
export function StageBadge({
  stage,
  className,
  size = 'default',
}: {
  stage: Pick<PipelineStageDto, 'name' | 'color'>;
  className?: string;
  size?: 'default' | 'sm';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        className,
      )}
      style={{
        borderColor: `${stage.color}59`,
        backgroundColor: `${stage.color}1f`,
        color: stage.color,
      }}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: stage.color }}
        aria-hidden
      />
      {stage.name}
    </span>
  );
}
