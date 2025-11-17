import { Injectable, computed, inject, signal, effect } from '@angular/core';
import { NavigationEnd, Router, ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ScheduleServices } from '../../service/schedule/schedule-services';

@Injectable({ providedIn: 'root' })
export class HeaderPathService {
  private router = inject(Router);
  private sch = inject(ScheduleServices);

  private _extraPath = signal<string>('');
  private _branchOverride = signal<string>('');
  private _doctorOverride = signal<string>('');

  private pageLabel = signal<string>('');

  private branchName = computed(() => {
    const id = this.sch.selectedBranchId?.();
    return id ? this.sch.branches()?.find((b) => b.id === id)?.name ?? '' : '';
  });

  private clinicName = computed(() => {
    const id = this.sch.selectedClinicId?.();
    return id ? this.sch.clinics?.find((c) => c.id === id)?.name ?? '' : '';
  });

  private doctorName = computed(() => {
    const cid = this.sch.selectedClinicId?.();
    const did = this.sch.selectedDoctorId?.();
    if (!cid || !did) return '';

    const doctors = this.sch.clinics?.find((c) => c.id === cid)?.doctors ?? [];
    const rawName = doctors.find((d) => d.id === did)?.name ?? '';

    return this.cleanDoctorPrefix(rawName);
  });

  readonly path = computed(() => {
    const parts: string[] = [];

    const b = (this._branchOverride() || this.branchName()).trim();
    const s = this.clinicName().trim();
    const d = (this._doctorOverride() || this.doctorName()).trim();
    const page = this.pageLabel().trim();

    if (b) parts.push(b);
    if (s) parts.push(s);
    if (d) parts.push(d);
    if (page) parts.push(page);

    return parts.join(' / ');
  });

  constructor() {
    this.restoreFromStorage();

    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.updateFromRoute();
    });
    this.updateFromRoute();

    effect(() => {
      void this.branchName();
      void this.clinicName();
      void this.doctorName();
      void this._doctorOverride();
    });
  }

  private restoreFromStorage() {
    const savedBranchId = Number(localStorage.getItem('qbook.branchId') || 0);
    const savedClinicId = Number(localStorage.getItem('qbook.clinicId') || 0);
    const savedDoctorId = Number(localStorage.getItem('qbook.doctorId') || 0);

    if (savedBranchId) {
      this.sch.setSelectedBranch(savedBranchId);
    }
    if (savedClinicId) {
      this.sch.setSelectedClinic(savedClinicId);
    }
    if (savedDoctorId) {
      this.sch.setSelectedDoctor(savedDoctorId);
    }
  }

  private cleanDoctorPrefix(name: string): string {
    if (!name) return '';
    return name.replace(/^\s*د[\/\.]?\s*/u, '').trim();
  }

  setExtraPath(path: string) {
    this._extraPath.set(path || '');
  }
  clearExtra() {
    this._extraPath.set('');
  }

  setBranchPath(path: string) {
    const clean = (path || '').split('/').pop()?.trim() ?? '';
    this._branchOverride.set(clean);
  }
  clearBranchPath() {
    this._branchOverride.set('');
  }

  setDoctorPath(name: string) {
    this._doctorOverride.set(this.cleanDoctorPrefix(name));
  }
  clearDoctorPath() {
    this._doctorOverride.set('');
  }

  private updateFromRoute() {
    const route = this.getDeepest(this.router.routerState.root as ActivatedRoute);
    const snap = route?.snapshot;
    if (!snap) return;

    let page = '';

    const routePath = snap.routeConfig?.path || '';
    const dataTitle = (snap.data?.['pageTitle'] || '').toString().toLowerCase();

    if (routePath.startsWith('patient/received')) {
      page = 'Reserved';
    } else if (routePath.startsWith('patient/available')) {
      page = 'Available';
    } else {
      if (dataTitle.includes('reserved')) page = 'Reserved';
      else if (dataTitle.includes('available')) page = 'Available';
      else page = '';
    }

    this.pageLabel.set(page);
  }

  private getDeepest(route: ActivatedRoute): ActivatedRoute {
    while (route.firstChild) route = route.firstChild;
    return route;
  }
}
