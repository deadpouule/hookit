"use client";

import { toast as sonnerToast } from "sonner";

export const toast = {
  success(message: string, description?: string) {
    sonnerToast.success(message, { description });
  },
  error(message: string, description?: string) {
    sonnerToast.error(message, { description });
  },
  info(message: string, description?: string) {
    sonnerToast.message(message, { description });
  },
  loading(message: string) {
    return sonnerToast.loading(message);
  },
  dismiss(id?: string | number) {
    sonnerToast.dismiss(id);
  },
  promise<T>(
    p: Promise<T>,
    msgs: { loading: string; success: string; error: string },
  ) {
    return sonnerToast.promise(p, msgs);
  },
};
