import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ScheduleServices } from '../../service/schedule/schedule-services';

@Injectable({ providedIn: 'root' })
export class HeaderPathService {
  private router = inject(Router);
  private sch = inject(ScheduleServices);

  private _branchPath = signal<string>('');
  private _extraPath = signal<string>('');

  readonly path = computed(() => {
    const b = this._branchPath().trim();
    const e = this._extraPath().trim();
    if (b && e) return `${b}${e.startsWith('/') ? '' : ' / '}${e}`;
    return b || e || '';
  });

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.updatePathFromRoute();
    });

    this.updatePathFromRoute();
  }

  private updatePathFromRoute() {
    const route = this.getDeepestRoute(this.router.routerState.root);
    const snap = route?.snapshot;
    const pageTitle: string | undefined = snap?.data?.['pageTitle'];

    const clinicIdParam = snap?.params?.['clinicId'];
    const doctorIdParam = snap?.params?.['doctorId'];
    const dayParam = snap?.params?.['day'];

    const clinicId = clinicIdParam ? Number(clinicIdParam) : this.sch.selectedClinicId();
    const clinicName = clinicId ? this.sch.clinics.find((c) => c.id === clinicId)?.name : undefined;

    let doctorName: string | undefined;
    if (doctorIdParam) {
      const dId = Number(doctorIdParam);
      const doctors = clinicId
        ? this.sch.clinics.find((c) => c.id === clinicId)?.doctors ?? []
        : [];
      doctorName = doctors.find((d) => d.id === dId)?.name;
    }

    const parts: string[] = [];
    if (pageTitle) parts.push(pageTitle);
    if (clinicName) parts.push(clinicName);

    const pathStr: string = snap?.routeConfig?.path ?? '';
    const isPatientPage = pathStr.startsWith('patient/');
    if (isPatientPage) {
      if (doctorName) parts.push(doctorName);
      if (dayParam) parts.push(`Day ${dayParam}`);
    }

    const extra = parts.join(' / ');
    if (extra) this._extraPath.set(extra);
  }

  private getDeepestRoute(route: any): any {
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route;
  }

  setBranchPath(path: string) {
    this._branchPath.set(path || '');
  }

  setExtraPath(path: string) {
    this._extraPath.set(path || '');
  }

  clearExtra() {
    this._extraPath.set('');
  }
}
