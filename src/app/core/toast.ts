import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'good' | 'bad';
  undo?: () => void;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  show(message: string, tone: Toast['tone'] = 'info', undo?: () => void): void {
    const id = ++this.seq;
    this.toasts.update((list) => [...list, { id, message, tone, undo }]);
    setTimeout(() => this.dismiss(id), 4200);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
