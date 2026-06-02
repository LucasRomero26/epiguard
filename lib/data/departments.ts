import type { Department } from '@/lib/types';
export type { Department };

export const DEPARTMENTS: Department[] = [
  { code: 5,  name: 'Antioquia',             population: 6677000, geoIndex: 0 },
  { code: 8,  name: 'Atlántico',             population: 2722000, geoIndex: 1 },
  { code: 13, name: 'Bolívar',               population: 2293000, geoIndex: 2 },
  { code: 15, name: 'Boyacá',                population: 1282000, geoIndex: 3 },
  { code: 17, name: 'Caldas',                population: 1013000, geoIndex: 4 },
  { code: 18, name: 'Caquetá',               population:  508000, geoIndex: 5 },
  { code: 19, name: 'Cauca',                 population: 1464000, geoIndex: 6 },
  { code: 20, name: 'Cesar',                 population: 1102000, geoIndex: 7 },
  { code: 23, name: 'Córdoba',               population: 1784000, geoIndex: 8 },
  { code: 25, name: 'Cundinamarca',          population: 3081000, geoIndex: 9 },
  { code: 27, name: 'Chocó',                population:  534000, geoIndex: 10 },
  { code: 41, name: 'Huila',                 population: 1213000, geoIndex: 11 },
  { code: 44, name: 'La Guajira',            population: 1029000, geoIndex: 12 },
  { code: 47, name: 'Magdalena',             population: 1395000, geoIndex: 13 },
  { code: 50, name: 'Meta',                  population:  996000, geoIndex: 14 },
  { code: 52, name: 'Nariño',               population: 1630000, geoIndex: 15 },
  { code: 54, name: 'Norte de Santander',    population: 1482000, geoIndex: 16 },
  { code: 63, name: 'Quindío',              population:  574000, geoIndex: 17 },
  { code: 66, name: 'Risaralda',             population:  960000, geoIndex: 18 },
  { code: 68, name: 'Santander',             population: 2280000, geoIndex: 19 },
  { code: 70, name: 'Sucre',                 population:  947000, geoIndex: 20 },
  { code: 73, name: 'Tolima',                population: 1420000, geoIndex: 21 },
  { code: 76, name: 'Valle del Cauca',       population: 4739000, geoIndex: 22 },
  { code: 81, name: 'Arauca',                population:  290000, geoIndex: 23 },
  { code: 85, name: 'Casanare',              population:  420000, geoIndex: 24 },
  { code: 86, name: 'Putumayo',              population:  359000, geoIndex: 25 },
  { code: 88, name: 'San Andrés',           population:   80000, geoIndex: 26 },
  { code: 91, name: 'Amazonas',              population:   83000, geoIndex: 27 },
  { code: 94, name: 'Guainía',              population:   51000, geoIndex: 28 },
  { code: 95, name: 'Guaviare',              population:   90000, geoIndex: 29 },
  { code: 97, name: 'Vaupés',               population:   46000, geoIndex: 30 },
  { code: 99, name: 'Vichada',               population:   90000, geoIndex: 31 },
];

export const getDepartmentByCode = (code: number): Department | undefined =>
  DEPARTMENTS.find(d => d.code === code);
