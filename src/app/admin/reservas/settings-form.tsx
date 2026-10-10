"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError, FormSuccess, Input, Select, Textarea } from "@/components/ui/field";
import { useFormAction } from "@/lib/use-form-action";
import { saveBookingSettings } from "./actions";

const DAYS = [
  ["mon", "Lunes"],
  ["tue", "Martes"],
  ["wed", "Miércoles"],
  ["thu", "Jueves"],
  ["fri", "Viernes"],
  ["sat", "Sábado"],
  ["sun", "Domingo"],
] as const;

type Values = {
  hours: Record<string, string>;
  bookingDurationMin: number;
  bookingSlotMin: number;
  bookingGraceMin: number;
  bookingLeadMin: number;
  bookingMaxDays: number;
  bookingMaxParty: number;
  bookingNotice: string;
};

export function BookingSettingsForm({ values, firstTime }: { values: Values; firstTime: boolean }) {
  const [state, action, pending] = useFormAction(saveBookingSettings, undefined);
  const fe = state?.fieldErrors ?? {};

  return (
    <form onSubmit={action} className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="space-y-6">
        <Card className="space-y-4 p-4 sm:p-6">
          <div>
            <h2 className="font-semibold">Horarios de llegada</h2>
            <p className="text-sm text-muted">
              Desde qué hora y hasta qué hora pueden llegar con reserva. Varias franjas separadas por coma; vacío = no se
              reserva ese día.
              {firstTime && " Te dejamos un horario de ejemplo: ajustalo y guardá."}
            </p>
          </div>
          <div className="space-y-2">
            {DAYS.map(([key, label]) => (
              <div key={key} className="grid grid-cols-[96px_1fr] items-start gap-3">
                <label htmlFor={`h-${key}`} className="pt-2.5 text-sm font-medium">
                  {label}
                </label>
                <div>
                  <Input id={`h-${key}`} name={`hours_${key}`} defaultValue={values.hours[key]} placeholder="Cerrado" />
                  {fe[`hours_${key}`] && <p className="mt-1 text-xs text-danger">{fe[`hours_${key}`]}</p>}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">Ejemplo: 13:00-15:30, 20:00-23:00</p>
        </Card>

        <Card className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
          <Field label="Duración de la reserva (min)" htmlFor="dur" hint="Cuánto ocupa la mesa" error={fe.bookingDurationMin}>
            <Input id="dur" name="bookingDurationMin" type="number" min={30} max={480} step={15} defaultValue={values.bookingDurationMin} />
          </Field>
          <Field label="Horarios cada" htmlFor="slot" error={fe.bookingSlotMin}>
            <Select id="slot" name="bookingSlotMin" defaultValue={String(values.bookingSlotMin)}>
              <option value="15">15 minutos</option>
              <option value="30">30 minutos</option>
              <option value="60">1 hora</option>
            </Select>
          </Field>
          <Field label="Tolerancia de espera (min)" htmlFor="grace" hint="Pasado esto sin llegar, la mesa se libera" error={fe.bookingGraceMin}>
            <Input id="grace" name="bookingGraceMin" type="number" min={0} max={120} defaultValue={values.bookingGraceMin} />
          </Field>
          <Field label="Antelación mínima (min)" htmlFor="lead" hint="Ej. 60: no se puede reservar para dentro de menos de 1 h" error={fe.bookingLeadMin}>
            <Input id="lead" name="bookingLeadMin" type="number" min={0} max={2880} step={15} defaultValue={values.bookingLeadMin} />
          </Field>
          <Field label="Reservar hasta (días)" htmlFor="days" hint="Cuántos días hacia adelante" error={fe.bookingMaxDays}>
            <Input id="days" name="bookingMaxDays" type="number" min={1} max={180} defaultValue={values.bookingMaxDays} />
          </Field>
          <Field label="Máximo de personas online" htmlFor="party" hint="Grupos más grandes: por teléfono" error={fe.bookingMaxParty}>
            <Input id="party" name="bookingMaxParty" type="number" min={1} max={50} defaultValue={values.bookingMaxParty} />
          </Field>
          <Field label="Aviso para el cliente (opcional)" htmlFor="notice" hint="Se muestra al reservar" error={fe.bookingNotice} className="sm:col-span-2">
            <Textarea id="notice" name="bookingNotice" rows={2} maxLength={300} defaultValue={values.bookingNotice} placeholder="Ej. Si venís con mascota, avisanos en comentarios." />
          </Field>
        </Card>
      </div>

      <Card className="space-y-4 p-4 lg:sticky lg:top-8">
        <p className="text-sm text-muted">
          La mesa se asigna sola: la más chica en la que entran (o dos juntas del mismo salón). Las mesas extra y las
          deshabilitadas no se reservan.
        </p>
        <FormError message={state?.error} />
        <FormSuccess message={state?.ok} />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Guardando…" : "Guardar configuración"}
        </Button>
      </Card>
    </form>
  );
}
