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
    return doctors.find((d) => d.id === did)?.name ?? '';
  });

  private pageDateLabel = signal<string>('');

  readonly path = computed(() => {
    const parts: string[] = [];
    const b = (this._branchOverride() || this.branchName()).trim();
    const s = this.clinicName().trim();
    const d = this.doctorName().trim();
    const day = this.pageDateLabel().trim();

    if (b) parts.push(b);
    if (s) parts.push(s);
    if (d) parts.push(d);
    if (day) parts.push(day);

    const extra = this._extraPath().trim();
    return extra ? `${parts.join(' / ')} ${extra}` : parts.join(' / ');
  });

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.updateFromRoute();
    });
    this.updateFromRoute();

    effect(() => {
      void this.branchName();
      void this.clinicName();
      void this.doctorName();
    });
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

  private updateFromRoute() {
    const route = this.getDeepest(this.router.routerState.root as ActivatedRoute);
    const snap = route?.snapshot;
    if (!snap) return;

    const dayParam = snap.params?.['day'];
    if (dayParam) {
      const dayNum = Number(dayParam);
      if (!Number.isNaN(dayNum)) {
        const now = new Date();
        const dateObj = new Date(now.getFullYear(), now.getMonth(), dayNum);
        const label = dateObj.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: '2-digit',
        });
        this.pageDateLabel.set(label);
      } else {
        this.pageDateLabel.set('');
      }
    } else {
      this.pageDateLabel.set('');
    }
  }

  private getDeepest(route: ActivatedRoute): ActivatedRoute {
    while (route.firstChild) route = route.firstChild;
    return route;
  }
}
