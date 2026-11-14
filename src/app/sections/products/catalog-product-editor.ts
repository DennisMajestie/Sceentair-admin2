import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ApiProduct,
  ApiProductVariant,
  ApiVariantAvailability,
  CatalogueApiService,
} from '../../core/catalogue-api.service';
import { ToastService } from '../../core/toast';
import { ApprovalsApiService } from '../../core/approvals-api.service';
import { AuthService } from '../../core/auth.service';
import { Drawer } from '../../ui/drawer';
import { Spinner } from '../../ui/spinner';

export interface CatalogCategoryOption {
  id: string;
  name: string;
}

interface CatalogVariantDraft {
  sku: string;
  size: string;
  colour: string;
  priceOverride: number | null;
  availabilityStatus: ApiVariantAvailability;
}

export type CatalogProductWorking =
  | ''
  | 'save'
  | 'variant'
  | 'sale-start'
  | 'sale-end'
  | 'delete'
  | 'category'
  | 'upload';

function suggestSku(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return letters || 'SKU';
}

function extractCreatedId(created: unknown): string | null {
  if (!created || typeof created !== 'object') return null;
  const result = created as { id?: unknown; data?: { id?: unknown } };
  if (typeof result.id === 'string') return result.id;
  if (typeof result.data?.id === 'string') return result.data.id;
  return null;
}

@Component({
  selector: 'app-catalog-product-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Drawer, FormsModule, Spinner],
  template: `
    <app-drawer [open]="open()" [label]="editing() ? 'Edit product' : 'New product'" (close)="closed.emit()">
      <ng-container drawerTitle>
        <div class="dtitle">
          <strong>{{ editing() ? 'Edit product' : 'New product' }}</strong>
          @if (product(); as current) {
            <span class="psub">{{ current.category || 'Product' }}</span>
          }
        </div>
      </ng-container>

      <form class="pform" (ngSubmit)="save()">
        <div class="pgrid">
          <label class="field field--span">
            <span class="field__label">Name</span>
            <input type="text" name="pName" [(ngModel)]="fName" required placeholder="Product name" />
          </label>
          <label class="field">
            <span class="field__label">Base price</span>
            <input type="number" name="pBasePrice" min="0" step="0.01" [(ngModel)]="fBasePrice" required />
          </label>
          <div class="field">
            <span class="field__label">Category</span>
            <select name="pCategory" [(ngModel)]="fCategory">
              <option value="">Not set</option>
              @for (option of categoryOptions(); track option.id) {
                <option [value]="option.name">{{ option.name }}</option>
              }
            </select>
            @if (addingCategory()) {
              <div class="category-inline">
                <input
                  type="text"
                  name="pNewCategory"
                  placeholder="New category name"
                  [(ngModel)]="cName"
                />
                <button
                  type="button"
                  class="btn btn--xs btn--ghost"
                  [disabled]="working() !== '' || !cName().trim()"
                  (click)="addCategory()"
                >
                  {{ working() === 'category' ? 'Adding…' : 'Add' }}
                </button>
                <button type="button" class="btn btn--xs btn--ghost" (click)="cancelAddCategory()">Cancel</button>
              </div>
            }
            @if (!addingCategory()) {
              <button type="button" class="add-category" (click)="addingCategory.set(true)">＋ Add category</button>
            }
          </div>
          <div class="field">
            <span class="field__label">Size class</span>
            <select name="pSizeClass" [(ngModel)]="fSizeClass">
              <option value="">Not set (medium)</option>
              <option value="light">Light</option>
              <option value="medium">Medium</option>
              <option value="heavy">Heavy</option>
            </select>
          </div>
          <label class="field field--span">
            <span class="field__label">Primary image URL</span>
            <input type="text" name="pPrimaryImage" placeholder="https://… or /uploads/…" [(ngModel)]="fPrimaryImage" />
          </label>
          <label class="field field--span">
            <span class="field__label">Upload image</span>
            <input type="file" accept="image/*" [disabled]="working() !== ''" (change)="onImageFile($event)" />
          </label>
          <label class="field field--span">
            <span class="field__label">Description</span>
            <textarea rows="3" name="pDescription" [(ngModel)]="fDescription"></textarea>
          </label>
        </div>
        <div class="form-actions">
          <button
            class="btn btn--primary"
            type="submit"
            [disabled]="working() !== '' || !fName().trim() || fBasePrice() === null || (!editing() && !fCategory().trim())"
          >
            @if (working() === 'save') {
              <app-spinner size="sm" />
              {{ editing() ? 'Saving' : 'Creating' }}
            } @else {
              {{ editing() ? 'Save changes' : 'Create product' }}
            }
          </button>
          <button class="btn btn--ghost" type="button" (click)="closed.emit()">Cancel</button>
        </div>
      </form>

      <section class="psection">
        <h3 class="dlabel">Variants</h3>
        @if (editing()) {
          <div class="variants-list">
            @for (variant of variants(); track variant.id) {
              <div class="variant-row">
                <span class="variant-row__sku">{{ variant.sku }}</span>
                <span>Size {{ variant.size ?? '—' }}</span>
                <span>Colour {{ variant.colour ?? '—' }}</span>
                @if (variant.priceOverride !== null) {
                  <span>Price {{ variant.priceOverride }}</span>
                }
                <span class="variant-row__status {{ availabilityTone(variant.availabilityStatus) }}">
                  {{ availabilityLabel(variant.availabilityStatus) }}
                </span>
              </div>
            } @empty {
              <p class="pempty">No variants yet.</p>
            }
          </div>
        } @else {
          @if (stagedVariant(); as staged) {
            <div class="variant-row">
              <span class="variant-row__sku">{{ staged.sku }}</span>
              <span>Size {{ staged.size || '—' }}</span>
              <span>Colour {{ staged.colour || '—' }}</span>
              <span class="variant-row__status {{ availabilityTone(staged.availabilityStatus) }}">
                {{ availabilityLabel(staged.availabilityStatus) }}
              </span>
              <button type="button" class="btn btn--xs btn--ghost" (click)="clearStaged()">Remove</button>
            </div>
          } @else {
            <p class="pempty">The product is created first; one staged variant is saved with it.</p>
          }
        }
        <form class="pform" (ngSubmit)="submitVariant()">
          <div class="pgrid">
            <label class="field">
              <span class="field__label">SKU</span>
              <input type="text" name="vSku" placeholder="Auto-suggested" [(ngModel)]="vSku" />
            </label>
            <label class="field">
              <span class="field__label">Size</span>
              <input type="text" name="vSize" [(ngModel)]="vSize" />
            </label>
            <label class="field">
              <span class="field__label">Colour</span>
              <input type="text" name="vColour" [(ngModel)]="vColour" />
            </label>
            <label class="field">
              <span class="field__label">Price override</span>
              <input type="number" name="vPriceOverride" min="0" step="0.01" [(ngModel)]="vPriceOverride" />
            </label>
            <div class="field">
              <span class="field__label">Availability</span>
              <select name="vAvailability" [(ngModel)]="vAvailability">
                <option value="in_stock">In stock</option>
                <option value="out_of_stock">Out of stock</option>
                <option value="made_to_order">Made to order</option>
              </select>
            </div>
          </div>
          <div class="form-actions">
            <button
              class="btn btn--ghost"
              type="submit"
              [disabled]="working() !== '' || (!vSku().trim() && !vSize().trim() && !vColour().trim())"
            >
              @if (working() === 'variant') {
                <app-spinner size="sm" />
                Adding
              } @else {
                {{ editing() ? 'Add variant' : 'Stage variant' }}
              }
            </button>
          </div>
        </form>
      </section>

      @if (editing()) {
        <section class="psection">
          <h3 class="dlabel">Sale</h3>
          @if (hasSale()) {
            <p class="sale-note">
              Active sale: <strong>{{ product()?.salePercent }}%</strong> off, ends {{ endsAtLabel() }}.
            </p>
            <div class="form-actions">
              <button class="btn btn--ghost destructive" type="button" [disabled]="working() !== ''" (click)="endSale()">
                {{ working() === 'sale-end' ? 'Ending…' : 'End sale' }}
              </button>
            </div>
          } @else {
            <div class="pgrid">
              <label class="field">
                <span class="field__label">Percent off</span>
                <input type="number" min="1" max="99" [(ngModel)]="sPercent" />
              </label>
              <label class="field">
                <span class="field__label">Ends at</span>
                <input type="datetime-local" [(ngModel)]="sEndsAt" />
              </label>
            </div>
            @if (!isOwner()) {
              <p class="sale-note">Starting a sale records a price-change approval request for this exact product, discount and end time.</p>
            }
            <div class="form-actions">
              <button
                class="btn btn--ghost"
                type="button"
                [disabled]="working() !== '' || !sPercent() || !sEndsAt()"
                (click)="startSale()"
              >
                {{ working() === 'sale-start' ? 'Starting…' : 'Start sale' }}
              </button>
            </div>
          }
        </section>

        <section class="psection">
          <h3 class="dlabel">Danger zone</h3>
          @if (confirmingDelete()) {
            <div class="remove-row">
              <button class="btn btn--ghost" type="button" (click)="confirmingDelete.set(false)">Keep</button>
              <button class="btn btn--ghost destructive" type="button" [disabled]="working() !== ''" (click)="removeProduct()">
                {{ working() === 'delete' ? 'Deleting…' : 'Confirm removal' }}
              </button>
            </div>
          } @else {
            <button class="btn btn--ghost destructive" type="button" [disabled]="working() !== ''" (click)="confirmingDelete.set(true)">
              Delete product
            </button>
          }
        </section>
      }
    </app-drawer>
  `,
  styles: `
    .dtitle { display: flex; align-items: baseline; gap: 9px; min-width: 0; }
    .dtitle strong { font-size: var(--fs-lg); }
    .psub { overflow: hidden; color: var(--faint); font-size: 11px; text-overflow: ellipsis; }
    .pform { display: grid; gap: 12px; }
    .psection { display: grid; gap: 12px; margin-top: 2px; padding-top: 14px; border-top: 1px solid var(--line); }
    .pgrid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .field { display: grid; gap: 5px; }
    .field--span { grid-column: 1 / -1; }
    .field input[type='text'],
    .field input[type='number'],
    .field input[type='datetime-local'],
    .field select,
    .field textarea {
      height: 42px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface);
      color: var(--text);
      font: inherit;
      font-size: var(--fs-md);
    }
    .field textarea { height: auto; padding: 10px 12px; resize: vertical; }
    .field input:focus-visible,
    .field select:focus-visible,
    .field textarea:focus-visible { outline: 2px solid var(--primary); }
    .field input[type='file'] { color: var(--muted); font-size: var(--fs-xs); }
    .field--check { justify-items: start; }
    .field--check input[type='checkbox'] { width: 18px; height: 18px; accent-color: var(--primary); }
    .category-inline { display: flex; align-items: center; gap: 8px; }
    .category-inline input { flex: 1; min-width: 0; height: 40px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--text); font: inherit; font-size: var(--fs-md); }
    .add-category { justify-self: start; padding: 0; border: 0; background: transparent; color: var(--primary); font: inherit; font-size: var(--fs-xs); font-weight: 700; cursor: pointer; }
    .form-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .dlabel { margin: 0; font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
    .variants-list { display: grid; gap: 6px; }
    .variant-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding: 8px 10px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--well);
      color: var(--muted);
      font-size: var(--fs-xs);
    }
    .variant-row__sku { color: var(--text); font-weight: 650; }
    .variant-row__status { margin-left: auto; font-weight: 700; }
    .variant-row__status.is-good { color: var(--good); }
    .variant-row__status.is-warn { color: var(--warn); }
    .variant-row__status.is-bad { color: var(--bad); }
    .pempty { margin: 0; color: var(--faint); font-size: var(--fs-xs); }
    .sale-note { margin: 0; color: var(--muted); font-size: var(--fs-xs); }
    .sale-note strong { color: var(--text); }
    .remove-row { display: flex; gap: 10px; justify-content: flex-end; }
    .destructive { color: var(--bad); }
  `,
})
export class CatalogApiProductEditor {
  private readonly api = inject(CatalogueApiService);
  private readonly approvalsApi = inject(ApprovalsApiService);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  protected readonly isOwner = computed(() => this.auth.user()?.role === 'business_owner_admin');

  readonly product = input<ApiProduct | null>(null);
  readonly categories = input<readonly CatalogCategoryOption[]>([]);
  readonly open = input(false);
  readonly saved = output<void>();
  readonly closed = output<void>();

  protected readonly working = signal<CatalogProductWorking>('');

  protected readonly fName = signal('');
  protected readonly fDescription = signal('');
  protected readonly fCategory = signal('');
  protected readonly fBasePrice = signal<number | null>(null);
  protected readonly fSizeClass = signal('');
  protected readonly fPrimaryImage = signal('');

  protected readonly vSku = signal('');
  protected readonly vSize = signal('');
  protected readonly vColour = signal('');
  protected readonly vPriceOverride = signal<number | null>(null);
  protected readonly vAvailability = signal<ApiVariantAvailability>('in_stock');
  protected readonly stagedVariant = signal<CatalogVariantDraft | null>(null);

  protected readonly sPercent = signal<number | null>(null);
  protected readonly sEndsAt = signal('');

  protected readonly cName = signal('');
  protected readonly addingCategory = signal(false);
  protected readonly confirmingDelete = signal(false);
  protected readonly extraCategories = signal<readonly CatalogCategoryOption[] | null>(null);

  protected readonly editing = computed(() => !!this.product());
  protected readonly hasSale = computed(() => {
    const current = this.product();
    return !!current && (current.salePercent != null || !!current.saleEndsAt);
  });
  protected readonly categoryOptions = computed(() => this.extraCategories() ?? this.categories());
  protected readonly variants = computed<readonly ApiProductVariant[]>(() => this.product()?.variants ?? []);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.resetForms();
    });
  }

  protected async save(): Promise<void> {
    const name = this.fName().trim();
    const basePrice = this.fBasePrice();
    const category = this.fCategory().trim();
    const sizeClass = this.fSizeClass().trim();
    if (!name || basePrice === null) return;
    const current = this.product();
    if (!current && !category) {
      this.toasts.show('Choose a category before creating the product.', 'bad');
      return;
    }
    let approvalRequestId: string | undefined;
    this.working.set('save');
    try {
      if (current && basePrice !== current.basePrice) {
        const approval = await this.approvalsApi.create({
          actionType: 'price_change',
          payload: { productId: current.id, from: current.basePrice, to: basePrice },
        });
        if (approval.status !== 'approved') {
          this.toasts.show(
            'Price change submitted - an owner or manager must approve it before it is applied.',
            'info',
          );
          return;
        }
        approvalRequestId = approval.id;
      }
      const body = {
        name,
        description: this.fDescription().trim() || null,
        ...(category ? { category } : {}),
        basePrice,
        ...(sizeClass ? { sizeClass } : {}),
        primaryImageUrl: this.fPrimaryImage().trim() || null,
        ...(approvalRequestId ? { approvalRequestId } : {}),
      };
      if (current) {
        await this.api.updateProduct(current.id, body);
        this.toasts.show('Product updated', 'good');
      } else {
        const createdId = extractCreatedId(await this.api.createProduct(body));
        const staged = this.stagedVariant();
        if (createdId && staged) {
          await this.api.createVariant(createdId, this.variantPayload(staged, name));
        }
        this.toasts.show(createdId && staged ? 'Product and variant created' : 'Product created', 'good');
      }
      this.saved.emit();
      this.closed.emit();
    } catch (err) {
      this.toasts.show(
        err instanceof Error ? err.message : 'The product could not be saved.',
        'bad',
      );
    } finally {
      this.working.set('');
    }
  }

  protected async onImageFile(event: Event): Promise<void> {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const file = target.files?.[0];
    if (!file) return;
    this.working.set('upload');
    try {
      const result = await this.api.uploadImage(file);
      this.fPrimaryImage.set(result.url);
      this.toasts.show('Image uploaded', 'good');
    } catch (err) {
      this.toasts.show(err instanceof Error ? err.message : 'Could not upload the image.', 'bad');
    } finally {
      this.working.set('');
      target.value = '';
    }
  }

  protected async addCategory(): Promise<void> {
    const name = this.cName().trim();
    if (!name) return;
    this.working.set('category');
    try {
      await this.api.createCategory(name);
      this.extraCategories.set(await this.api.categories());
      this.fCategory.set(name);
      this.cName.set('');
      this.addingCategory.set(false);
      this.toasts.show('Category added', 'good');
    } catch (err) {
      this.toasts.show(err instanceof Error ? err.message : 'Could not add the category.', 'bad');
    } finally {
      this.working.set('');
    }
  }

  protected cancelAddCategory(): void {
    this.cName.set('');
    this.addingCategory.set(false);
  }

  protected async submitVariant(): Promise<void> {
    if (this.editing()) await this.addVariant();
    else this.stageVariant();
  }

  protected clearStaged(): void {
    this.stagedVariant.set(null);
  }

  protected async startSale(): Promise<void> {
    const current = this.product();
    const percent = this.sPercent();
    const endsAtRaw = this.sEndsAt();
    if (!current || !percent || !endsAtRaw) return;
    const parsed = new Date(endsAtRaw);
    const endsAt = Number.isNaN(parsed.getTime()) ? endsAtRaw : parsed.toISOString();
    this.working.set('sale-start');
    try {
      const approval = await this.approvalsApi.create({
        actionType: 'price_change',
        payload: {
          kind: 'sale',
          productId: current.id,
          salePercent: percent,
          saleEndsAt: endsAt,
        },
      });
      if (approval.status !== 'approved') {
        this.toasts.show(
          'Sale submitted - an owner or manager must approve it before it starts.',
          'info',
        );
        return;
      }
      await this.api.setProductSale(current.id, { percent, endsAt, approvalRequestId: approval.id });
      this.sPercent.set(null);
      this.sEndsAt.set('');
      this.toasts.show('Sale started', 'good');
      this.saved.emit();
    } catch (err) {
      this.toasts.show(err instanceof Error ? err.message : 'Could not start the sale.', 'bad');
    } finally {
      this.working.set('');
    }
  }

  protected async endSale(): Promise<void> {
    const current = this.product();
    if (!current) return;
    this.working.set('sale-end');
    try {
      await this.api.endProductSale(current.id);
      this.toasts.show('Sale ended', 'good');
      this.saved.emit();
    } catch (err) {
      this.toasts.show(err instanceof Error ? err.message : 'Could not end the sale.', 'bad');
    } finally {
      this.working.set('');
    }
  }

  protected async removeProduct(): Promise<void> {
    const current = this.product();
    if (!current) return;
    this.working.set('delete');
    try {
      await this.api.deleteProduct(current.id);
      this.toasts.show('Product deleted', 'good');
      this.saved.emit();
      this.closed.emit();
    } catch (err) {
      this.toasts.show(err instanceof Error ? err.message : 'Could not delete the product.', 'bad');
    } finally {
      this.working.set('');
    }
  }

  protected availabilityLabel(status: string): string {
    switch (status) {
      case 'in_stock':
        return 'In stock';
      case 'out_of_stock':
        return 'Out of stock';
      case 'made_to_order':
        return 'Made to order';
      default:
        return status;
    }
  }

  protected availabilityTone(status: string): string {
    switch (status) {
      case 'in_stock':
        return 'is-good';
      case 'out_of_stock':
        return 'is-bad';
      case 'made_to_order':
        return 'is-warn';
      default:
        return '';
    }
  }

  protected endsAtLabel(): string {
    const raw = this.product()?.saleEndsAt;
    if (!raw) return '—';
    const time = new Date(raw).getTime();
    if (Number.isNaN(time)) return raw;
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(time);
  }

  private stageVariant(): void {
    const draft = this.variantDraft();
    this.stagedVariant.set(draft);
    this.resetVariantForm(this.fName());
  }

  private async addVariant(): Promise<void> {
    const current = this.product();
    const draft = this.variantDraft();
    if (!current) return;
    this.working.set('variant');
    try {
      await this.api.createVariant(current.id, this.variantPayload(draft, current.name));
      this.resetVariantForm(current.name);
      this.toasts.show('Variant added', 'good');
      this.saved.emit();
    } catch (err) {
      this.toasts.show(err instanceof Error ? err.message : 'Could not add the variant.', 'bad');
    } finally {
      this.working.set('');
    }
  }

  private variantDraft(): CatalogVariantDraft {
    return {
      sku: this.vSku().trim(),
      size: this.vSize().trim(),
      colour: this.vColour().trim(),
      priceOverride: this.vPriceOverride(),
      availabilityStatus: this.vAvailability(),
    };
  }

  private variantPayload(
    draft: CatalogVariantDraft,
    name: string,
  ): Partial<ApiProductVariant> & Record<string, unknown> {
    return {
      sku: draft.sku || suggestSku(name),
      size: draft.size || null,
      colour: draft.colour || null,
      priceOverride:
        draft.priceOverride !== null && Number.isFinite(draft.priceOverride) ? draft.priceOverride : null,
      availabilityStatus: draft.availabilityStatus,
    };
  }

  private resetVariantForm(name: string): void {
    this.vSku.set(name.trim() ? suggestSku(name) : '');
    this.vSize.set('');
    this.vColour.set('');
    this.vPriceOverride.set(null);
    this.vAvailability.set('in_stock');
  }

  private resetForms(): void {
    const current = this.product();
    this.working.set('');
    this.confirmingDelete.set(false);
    this.addingCategory.set(false);
    this.extraCategories.set(null);
    this.stagedVariant.set(null);
    this.fName.set(current?.name ?? '');
    this.fDescription.set(current?.description ?? '');
    this.fCategory.set(current?.category ?? '');
    this.fBasePrice.set(current?.basePrice ?? null);
    this.fSizeClass.set(current?.sizeClass ?? '');
    this.fPrimaryImage.set(current?.primaryImageUrl ?? '');
    this.resetVariantForm(current?.name ?? '');
    this.sPercent.set(null);
    this.sEndsAt.set('');
    this.cName.set('');
  }
}
