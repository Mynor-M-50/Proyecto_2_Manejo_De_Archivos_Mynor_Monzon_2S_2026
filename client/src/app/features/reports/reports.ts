import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { EMPTY, Subject, catchError, switchMap, tap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { User } from '../../core/models';
import { CatalogItem, ReportResponse, ReportsService } from '../../core/reports.service';
import { UsersService } from '../../core/users.service';
import { saveBlob } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { ADMIN_ONLY_PARAMS, FieldOption, PARAM_FIELDS, REPORTS, ReportDef } from './reports.config';

// Un filtro ya listo para dibujar en pantalla
interface FieldView {
  name: string;
  label: string;
  kind: 'date' | 'number' | 'checkbox' | 'select' | 'user';
  options: FieldOption[];
  placeholder: string;
}

interface Group {
  name: string;
  items: CatalogItem[];
}

// Reportes: el administrador ve los 12 (globales); un usuario ve solo los suyos
@Component({
  selector: 'app-reports',
  imports: [FormsModule, Icon],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports {
  private readonly api = inject(ReportsService);
  private readonly usersApi = inject(UsersService);
  private readonly auth = inject(AuthService);

  protected readonly isAdmin = this.auth.isAdmin;

  protected readonly catalog = signal<CatalogItem[]>([]);
  protected readonly users = signal<User[]>([]);
  protected readonly loadingCatalog = signal(true);
  protected readonly catalogError = signal('');

  protected readonly selected = signal<CatalogItem | null>(null);
  protected readonly values = signal<Record<string, string>>({});
  protected readonly running = signal(false);
  protected readonly error = signal('');
  protected readonly rows = signal<any[]>([]);
  protected readonly summary = signal('');
  protected readonly hasResult = signal(false);

  protected readonly def = computed<ReportDef | null>(() => {
    const item = this.selected();
    return item ? (REPORTS[item.key] ?? null) : null;
  });

  // Los reportes del servidor agrupados por tema (solo los que esta pantalla sabe dibujar)
  protected readonly groups = computed<Group[]>(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const item of this.catalog()) {
      if (!REPORTS[item.key]) {
        continue;
      }
      map.set(item.group, [...(map.get(item.group) ?? []), item]);
    }
    return Array.from(map, ([name, items]) => ({ name, items }));
  });

  protected readonly fields = computed<FieldView[]>(() => {
    const item = this.selected();
    const def = this.def();
    if (!item || !def) {
      return [];
    }
    return item.params
      .filter((name) => PARAM_FIELDS[name] && (this.isAdmin() || !ADMIN_ONLY_PARAMS.includes(name)))
      .map((name) => {
        const field = PARAM_FIELDS[name];
        let options = field.options ?? [];
        if (field.kind === 'user') {
          const users = this.users().map((u) => ({ value: u.id, label: u.name + ' (' + u.email + ')' }));
          // En los reportes de "usuario seleccionado" siempre hay uno elegido; en los demas se puede ver a todos
          const required = name === 'userId' && def.userMode === 'selected';
          options = required ? users : [{ value: '', label: 'Todos los usuarios' }, ...users];
        }
        const limitHint = name === 'limit' && def.limit ? 'Por defecto ' + def.limit.default + ' (maximo ' + def.limit.max + ')' : '';
        return { name, label: field.label, kind: field.kind, options, placeholder: limitHint };
      });
  });

  protected readonly maxBar = computed(() => {
    const bar = this.def()?.bar;
    return bar ? Math.max(0, ...this.rows().map((row) => bar.value(row))) : 0;
  });

  private readonly run$ = new Subject<{ item: CatalogItem; params: Record<string, string> }>();

  constructor() {
    this.api.catalog().subscribe({
      next: (res) => {
        this.catalog.set(res.reports);
        this.loadingCatalog.set(false);
      },
      error: (err) => {
        this.catalogError.set(errorMessage(err));
        this.loadingCatalog.set(false);
      },
    });

    // Solo el administrador necesita la lista de usuarios (para elegir de quien ver el reporte)
    if (this.isAdmin()) {
      this.usersApi.list().subscribe({ next: (res) => this.users.set(res.users) });
    }

    // Si se pide otro reporte antes de que termine el anterior, se descarta el anterior
    this.run$
      .pipe(
        tap(() => {
          this.running.set(true);
          this.error.set('');
        }),
        switchMap(({ item, params }) =>
          this.api.run(item.key, params).pipe(
            catchError((err) => {
              this.running.set(false);
              this.hasResult.set(false);
              this.rows.set([]);
              this.error.set(errorMessage(err));
              return EMPTY;
            })
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe((res) => this.showResult(res));
  }

  // Elige un reporte y lo ejecuta con sus valores por defecto
  protected select(item: CatalogItem): void {
    this.selected.set(item);
    this.values.set(this.defaultValues(item));
    this.hasResult.set(false);
    this.rows.set([]);
    this.error.set('');
    this.run();
  }

  // Valores iniciales de los filtros del reporte
  private defaultValues(item: CatalogItem): Record<string, string> {
    const values: Record<string, string> = {};
    const def = REPORTS[item.key];
    // Para el administrador, "usuario seleccionado" empieza siendo el mismo
    if (this.isAdmin() && item.params.includes('userId') && def?.userMode === 'selected') {
      values['userId'] = this.auth.user()?.id ?? '';
    }
    if (item.params.includes('period')) {
      values['period'] = 'day';
    }
    return values;
  }

  // Valor actual de un filtro; si todavia no se eligio nada, texto vacio
  protected valueOf(name: string): string {
    return this.values()[name] ?? '';
  }

  // Guarda el valor de un filtro
  protected setValue(name: string, value: unknown): void {
    this.values.update((current) => ({ ...current, [name]: String(value ?? '') }));
  }

  // Ejecuta el reporte con los filtros actuales
  protected run(): void {
    const item = this.selected();
    const def = this.def();
    if (!item || !def) {
      return;
    }

    const values = this.values();
    const from = values['from'];
    const to = values['to'];
    if (from && to && from > to) {
      this.error.set('La fecha Desde debe ser anterior o igual a Hasta');
      return;
    }
    const limit = values['limit'];
    if (limit && def.limit) {
      const n = Number(limit);
      if (!Number.isInteger(n) || n < 1 || n > def.limit.max) {
        this.error.set('La cantidad maxima debe ser un numero entre 1 y ' + def.limit.max);
        return;
      }
    }

    const params: Record<string, string> = {};
    for (const field of this.fields()) {
      const value = values[field.name];
      if (value) {
        params[field.name] = value;
      }
    }
    this.run$.next({ item, params });
  }

  // Muestra las filas devueltas por el servidor
  private showResult(res: ReportResponse): void {
    const def = this.def();
    this.rows.set(res.items);
    this.summary.set(def?.summary ? def.summary(res) : '');
    this.hasResult.set(true);
    this.running.set(false);
  }

  // Ancho de la barra de una fila respecto al valor mayor
  protected barPercent(row: any): number {
    const bar = this.def()?.bar;
    const max = this.maxBar();
    return bar && max > 0 ? Math.round((bar.value(row) * 100) / max) : 0;
  }

  // Descarga el reporte que se ve en pantalla como CSV (se abre en Excel)
  protected exportCsv(): void {
    const def = this.def();
    if (!def || this.rows().length === 0) {
      return;
    }
    const cell = (value: unknown): string => '"' + String(value ?? '').replace(/"/g, '""') + '"';
    const lines = [def.columns.map((c) => cell(c.header)).join(',')];
    for (const row of this.rows()) {
      lines.push(def.columns.map((c) => cell(c.value(row))).join(','));
    }
    // El caracter BOM al inicio hace que Excel respete los acentos
    const bom = String.fromCharCode(0xfeff);
    const now = new Date();
    const stamp = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    saveBlob(new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), def.filename + '-' + stamp + '.csv');
  }
}
