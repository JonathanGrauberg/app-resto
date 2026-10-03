"use client";

import { startTransition, useActionState, type FormEvent } from "react";

/**
 * Como `useActionState`, pero sin el reseteo automático del formulario de React 19:
 * si la validación falla, lo que el usuario escribió queda en pantalla.
 * Uso: `<form onSubmit={onSubmit}>` en lugar de `<form action={...}>`.
 */
export function useFormAction<S>(fn: (state: Awaited<S>, formData: FormData) => S | Promise<S>, initial: Awaited<S>) {
  const [state, dispatch, pending] = useActionState(fn, initial);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => dispatch(formData));
  };

  return [state, onSubmit, pending] as const;
}
