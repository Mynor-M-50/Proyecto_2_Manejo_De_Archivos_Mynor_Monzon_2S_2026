import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from './config';

export interface CatalogItem {
  key: string;
  group: string;
  title: string;
  adminOnly: boolean;
  params: string[];
}

// Respuesta de un reporte: cada uno trae sus filas en items y, a veces, un total
export interface ReportResponse {
  items: any[];
  total?: number;
  period?: string;
  userId?: string;
}

// Llamadas al servidor para los reportes
@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/reports`;

  // Reportes disponibles para el usuario actual (el administrador ve mas)
  catalog() {
    return this.http.get<{ reports: CatalogItem[] }>(this.url);
  }

  // Ejecuta un reporte con los filtros indicados
  run(key: string, params: Record<string, string>) {
    return this.http.get<ReportResponse>(`${this.url}/${key}`, { params });
  }
}
