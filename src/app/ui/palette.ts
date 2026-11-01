import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '../core/store';
import { NAV } from '../core/nav';
import { Icon } from './icon';

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    @if (open()) {
      <div class="scrim" (click)="close()"></div>
      <div class="finder" role="dialog" aria-modal="true" aria-label="Command palette">
        <div class="finder__bar">
          <app-icon name="search" [size]="17" />
          <input
            #q
            type="text"
            placeholder="Search products, orders, customers — or jump to a page"
            [value]="query()"
            (input)="query.set(q.value)"
            (keydown)="onKey($event)"
            aria-label="Search"
          />
          <kbd>Esc</kbd>
        </div>
        <div class="finder__list" role="listbox">
          @if (results().length === 0) {
            <div class="finder__empty">No matches for “{{ query() }}”</div>
          }
          @for (row of results(); track row.id) {
            <button
              type="button"
              class="finder__row"
              [class.is-on]="row.id === activeId()"
              role="option"
              [attr.aria-selected]="row.id === activeId()"
              (mouseenter)="activeId.set(row.id)"
              (click)="go(row.path)"
            >
              <span class="finder__ico"><app-icon [name]="row.icon" [size]="15" /></span>
              <span class="finder__label">{{ row.label }}</span>
              @if (row.hint) {
                <span class="finder__hint">{{ row.hint }}</span>
              }
              <span class="finder__group">{{ row.group }}</span>
            </button>
          }
        </div>
        <div class="finder__foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>Esc</kbd> dismiss</span>
        </div>
      </div>
    }
  `,
  styles: `
    .scrim {
      position: fixed;
      inset: 0;
      background: #14241c66;
      backdrop-filter: blur(3px);
      z-index: 60;
      animation: fade 0.16s var(--ease);
    }
    .finder {
      position: fixed;
      z-index: 61;
      top: 12vh;
      left: 50%;
      transform: translateX(-50%);
      width: min(620px, 92vw);
      background: var(--surface);
      border: 1px solid var(--line-2);
      border-radius: 18px;
      box-shadow: var(--shadow-pop);
      overflow: hidden;
      animation: rise 0.18s var(--ease);
    }
    .finder__bar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 13px 16px;
      border-bottom: 1px solid var(--line);
      color: var(--faint);
    }
    .finder__bar input {
      flex: 1;
      border: none;
      background: none;
      outline: none;
      font-size: var(--fs-lg);
      color: var(--text);
    }
    kbd {
      font-family: inherit;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 5px;
      background: var(--well);
      color: var(--faint);
    }
    .finder__list {
      max-height: 52vh;
      overflow-y: auto;
      padding: 6px;
    }
    .finder__row {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 8px 10px;
      border: none;
      border-radius: 10px;
      background: none;
      text-align: left;
      cursor: pointer;
      font-size: var(--fs-md);
    }
    .finder__row.is-on {
      background: var(--well);
    }
    .finder__ico {
      display: grid;
      place-items: center;
      width: 26px;
      height: 26px;
      border-radius: 8px;
      background: var(--surface-2);
      color: var(--muted);
      flex: none;
    }
    .finder__label {
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .finder__hint {
      font-size: var(--fs-xs);
      color: var(--faint);
      white-space: nowrap;
    }
    .finder__group {
      margin-left: auto;
      font-size: var(--fs-2xs);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--faint);
      flex: none;
    }
    .finder__empty {
      padding: 28px;
      text-align: center;
      color: var(--faint);
      font-size: var(--fs-md);
    }
    .finder__foot {
      display: flex;
      gap: 16px;
      padding: 9px 16px;
      border-top: 1px solid var(--line);
      background: var(--surface-2);
      font-size: var(--fs-2xs);
      color: var(--faint);
    }
    .finder__foot span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    @keyframes fade {
      from { opacity: 0; }
    }
    @keyframes rise {
      from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
    }
  `,
})
export class Palette {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly open = signal(false);
  readonly query = signal('');
  readonly activeId = signal('');
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('q');

  constructor() {
    effect(() => {
      if (this.open()) {
        setTimeout(() => this.input()?.nativeElement.focus(), 30);
      }
    });
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.toggle();
      } else if (e.key === 'Escape' && this.open()) {
        this.close();
      }
    });
  }

  toggle(): void {
    this.open.update((v) => !v);
    if (!this.open()) this.query.set('');
  }

  close(): void {
    this.open.set(false);
  }

  private readonly index = computed<Command[]>(() => {
    const cmds: Command[] = [];
    for (const section of NAV) {
      for (const page of section.pages) {
        cmds.push({
          id: `nav-${section.id}-${page.path}`,
          group: 'Go to',
          label: page.label,
          hint: section.label,
          path: page.path,
          icon: section.icon,
        });
      }
    }
    for (const p of this.store.products()) {
      cmds.push({
        id: `p-${p.id}`,
        group: 'Products',
        label: `${p.name} ${p.size}`,
        hint: p.sku,
        path: `/products/item/${p.id}`,
        icon: 'products',
      });
    }
    for (const o of this.store.orders().slice(-120)) {
      cmds.push({
        id: `o-${o.id}`,
        group: 'Orders',
        label: o.number,
        hint: this.store.customer(o.customerId)?.name ?? '',
        path: `/orders/all/${o.id}`,
        icon: 'orders',
      });
    }
    for (const c of this.store.customers()) {
      cmds.push({
        id: `c-${c.id}`,
        group: 'Customers',
        label: c.name,
        hint: c.city,
        path: `/customers/stockists/${c.id}`,
        icon: 'customers',
      });
    }
    for (const m of this.store.materials()) {
      cmds.push({
        id: `m-${m.id}`,
        group: 'Materials',
        label: m.name,
        hint: m.code,
        path: `/purchasing/materials/${m.id}`,
        icon: 'purchasing',
      });
    }
    for (const s of this.store.suppliers()) {
      cmds.push({
        id: `s-${s.id}`,
        group: 'Suppliers',
        label: s.name,
        hint: s.city,
        path: `/purchasing/suppliers/${s.id}`,
        icon: 'truck',
      });
    }
    return cmds;
  });

  protected readonly results = computed<Command[]>(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.index().filter((c) => c.group === 'Go to').slice(0, 12);
    return this.index()
      .filter((c) => `${c.label} ${c.hint ?? ''} ${c.group}`.toLowerCase().includes(q))
      .slice(0, 40);
  });

  onKey(event: KeyboardEvent): void {
    const rows = this.results();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const idx = rows.findIndex((r) => r.id === this.activeId());
      const next = event.key === 'ArrowDown' ? idx + 1 : idx - 1;
      const clamped = (next + rows.length) % rows.length;
      this.activeId.set(rows[clamped]?.id ?? '');
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const row = rows.find((r) => r.id === this.activeId()) ?? rows[0];
      if (row) this.go(row.path);
    }
  }

  go(path: string): void {
    this.close();
    this.router.navigateByUrl(path);
  }
}
