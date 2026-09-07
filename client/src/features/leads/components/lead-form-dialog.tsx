import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  LEAD_PRIORITIES,
  LEAD_SOURCES,
  createLeadSchema,
  type CreateLeadFormValues,
  type CreateLeadInput,
  type LeadDetailDto,
  type PipelineStageDto,
} from '@leadpilot/shared';
import { AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFormError } from '@/features/auth/use-form-error';
import { PRIORITY_LABELS, SOURCE_LABELS } from '@/lib/labels';
import { useCreateLead, useUpdateLead, type TeamMemberDetail } from '../api';

/** Sentinel for the assignee Select — Radix cannot hold an empty string value. */
const NO_ASSIGNEE = '__none__';

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` in the viewer's own timezone. */
function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: PipelineStageDto[];
  members: TeamMemberDetail[];
  defaultCurrency: string;
  /** Present when editing; omitted when creating. */
  lead?: LeadDetailDto;
  onCreated?: (lead: LeadDetailDto) => void;
}

/**
 * One dialog handles both create and edit.
 *
 * The two forms have identical fields and identical validation — splitting them
 * would duplicate every field for the sake of one changed verb.
 */
export function LeadFormDialog({
  open,
  onOpenChange,
  stages,
  members,
  defaultCurrency,
  lead,
  onCreated,
}: LeadFormDialogProps) {
  const isEditing = Boolean(lead);
  const createLead = useCreateLead();
  const updateLead = useUpdateLead(lead?.id ?? '');

  // Three generics: the form holds the schema's *input* shape, and
  // `handleSubmit` receives the parsed output — defaults applied, values coerced.
  const form = useForm<CreateLeadFormValues, unknown, CreateLeadInput>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: {
      customerName: '',
      company: '',
      email: '',
      phone: '',
      source: 'WEBSITE',
      requestedService: '',
      estimatedValue: 0,
      priority: 'MEDIUM',
      stageKey: 'NEW',
      assignedToId: null,
      description: '',
      nextFollowUpAt: null,
    },
  });

  const { formError, handleError, clearFormError } = useFormError(form.setError);

  // Reset whenever the dialog opens so a cancelled edit never leaks into the
  // next one, and an edit always starts from the record's current values.
  useEffect(() => {
    if (!open) return;
    clearFormError();
    form.reset(
      lead
        ? {
            customerName: lead.customerName,
            company: lead.company ?? '',
            email: lead.email ?? '',
            phone: lead.phone ?? '',
            source: lead.source,
            requestedService: lead.requestedService,
            estimatedValue: lead.estimatedValue,
            priority: lead.priority,
            stageKey: lead.stage.key,
            assignedToId: lead.assignedTo?.id ?? null,
            description: lead.description ?? '',
            nextFollowUpAt: lead.nextFollowUpAt,
          }
        : {
            customerName: '',
            company: '',
            email: '',
            phone: '',
            source: 'WEBSITE',
            requestedService: '',
            estimatedValue: 0,
            priority: 'MEDIUM',
            stageKey: 'NEW',
            assignedToId: null,
            description: '',
            nextFollowUpAt: null,
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead?.id]);

  const onSubmit = async (values: CreateLeadInput) => {
    clearFormError();
    try {
      if (lead) {
        await updateLead.mutateAsync(values);
        toast.success('Lead updated');
      } else {
        const created = await createLead.mutateAsync(values);
        toast.success('Lead created', { description: created.customerName });
        onCreated?.(created);
      }
      onOpenChange(false);
    } catch (error) {
      handleError(error);
    }
  };

  const errors = form.formState.errors;
  const activeMembers = members.filter((member) => member.isActive);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{isEditing ? 'Edit lead' : 'New lead'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the details for this lead.'
              : 'Capture an enquiry so it never falls through the cracks.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {/*
            A plain overflow container, not <ScrollArea>. Radix's viewport is
            `size-full`, so against a parent with only `max-height` its
            `height:100%` resolves to the content height — the viewport then
            overflowed the box and covered the footer, making Cancel and the
            submit button physically unclickable at every viewport.
          */}
          <div className="scrollbar-slim max-h-[62svh] overflow-y-auto overscroll-contain">
            <div className="space-y-5 px-6 py-5">
              {formError && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Customer name *</Label>
                  <Input
                    id="customerName"
                    placeholder="Ahmed Al Mansoori"
                    aria-invalid={Boolean(errors.customerName)}
                    {...form.register('customerName')}
                  />
                  {errors.customerName && (
                    <p className="text-sm text-destructive">{errors.customerName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    placeholder="Gulf Horizon Holdings"
                    {...form.register('company')}
                  />
                  {errors.company && (
                    <p className="text-sm text-destructive">{errors.company.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="ahmed@example.com"
                    aria-invalid={Boolean(errors.email)}
                    {...form.register('email')}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+971 50 123 4567"
                    aria-invalid={Boolean(errors.phone)}
                    {...form.register('phone')}
                  />
                  {errors.phone && (
                    <p className="text-sm text-destructive">{errors.phone.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="requestedService">Requested service *</Label>
                <Input
                  id="requestedService"
                  placeholder="Off-plan apartment investment"
                  aria-invalid={Boolean(errors.requestedService)}
                  {...form.register('requestedService')}
                />
                {errors.requestedService && (
                  <p className="text-sm text-destructive">{errors.requestedService.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimatedValue">Estimated value</Label>
                <div className="relative">
                  <Input
                    id="estimatedValue"
                    type="number"
                    min={0}
                    step={1000}
                    inputMode="decimal"
                    className="pr-14"
                    aria-describedby="currency-hint"
                    aria-invalid={Boolean(errors.estimatedValue)}
                    {...form.register('estimatedValue')}
                  />
                  {/* Currency is a workspace setting, not a per-lead choice — the
                      pipeline totals sum these figures directly. */}
                  <span
                    id="currency-hint"
                    className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-muted-foreground"
                  >
                    {defaultCurrency}
                  </span>
                </div>
                {errors.estimatedValue && (
                  <p className="text-sm text-destructive">{errors.estimatedValue.message}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="source">Lead source</Label>
                  <Controller
                    control={form.control}
                    name="source"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="source" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_SOURCES.map((source) => (
                            <SelectItem key={source} value={source}>
                              {SOURCE_LABELS[source]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Controller
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="priority" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_PRIORITIES.map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              {PRIORITY_LABELS[priority]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stageKey">Pipeline stage</Label>
                  <Controller
                    control={form.control}
                    name="stageKey"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="stageKey" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {stages.map((stage) => (
                            <SelectItem key={stage.id} value={stage.key}>
                              <span className="flex items-center gap-2">
                                <span
                                  className="size-2 rounded-full"
                                  style={{ backgroundColor: stage.color }}
                                  aria-hidden
                                />
                                {stage.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignedToId">Assigned rep</Label>
                  <Controller
                    control={form.control}
                    name="assignedToId"
                    render={({ field }) => (
                      <Select
                        value={field.value ?? NO_ASSIGNEE}
                        onValueChange={(value) =>
                          field.onChange(value === NO_ASSIGNEE ? null : value)
                        }
                      >
                        <SelectTrigger id="assignedToId" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_ASSIGNEE}>Unassigned</SelectItem>
                          {activeMembers.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nextFollowUpAt">Next follow-up</Label>
                <Controller
                  control={form.control}
                  name="nextFollowUpAt"
                  render={({ field }) => (
                    <Input
                      id="nextFollowUpAt"
                      type="datetime-local"
                      value={toLocalInputValue(field.value)}
                      onChange={(event) => field.onChange(fromLocalInputValue(event.target.value))}
                    />
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Notes</Label>
                <Textarea
                  id="description"
                  rows={3}
                  placeholder="Anything the team should know before the first call…"
                  {...form.register('description')}
                />
                {errors.description && (
                  <p className="text-sm text-destructive">{errors.description.message}</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={form.formState.isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isEditing ? 'Save changes' : 'Create lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
