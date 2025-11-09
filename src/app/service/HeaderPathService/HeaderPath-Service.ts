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
    if (!snap) return;

    const pageTitle: string | undefined = snap.data?.['pageTitle'];

    const clinicIdParam = snap.params?.['clinicId'];
    const doctorIdParam = snap.params?.['doctorId'];
    const dayParam = snap.params?.['day'];

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

    const pathStr: string = snap.routeConfig?.path ?? '';
    const isPatientPage = pathStr.startsWith('patient/');

    const parts: string[] = [];

    if (clinicName) parts.push(clinicName);
    if (doctorName) parts.push(doctorName);

    if (isPatientPage) {
      if (dayParam) {
        const dayNum = Number(dayParam);
        if (!Number.isNaN(dayNum)) {
          const currentMonth = new Date().getMonth();
          const currentYear = new Date().getFullYear();
          const dateObj = new Date(currentYear, currentMonth, dayNum);
          const dayLabel = dateObj.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: '2-digit',
          });
          parts.push(dayLabel);
        }
      }

      const suffix = pageTitle ? ` (${pageTitle})` : '';
      const extra = (parts.join(' / ') + suffix).trim();

      if (extra) this._extraPath.set(extra);
    } else {
      if (pageTitle) parts.unshift(pageTitle);
      const extra = parts.join(' / ');
      if (extra) this._extraPath.set(extra);
    }
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
