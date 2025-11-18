import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs/operators';

import {
  Branch,
  DayStats,
  Doctor,
  ScheduleServices,
} from '../../service/schedule/schedule-services';
import { HeaderPathService } from '../../service/HeaderPathService/HeaderPath-Service';
import { TicketSearchResultDto } from '../../service/global-search/ticket-search-box';
import { TicketSearchBusService } from '../../service/global-search/ticket-search.service';
import {
  TicketReservation,
  TicketPrintDto,
} from '../../service/ticket-reservation/ticket-reservation';
import { GlobalConfigService } from '../../service/config/global-config-service';
import { AppToastService } from '../../service/Toastr/app-toast.service';

// ✅ سيرفس اللغة
import { LanguageService } from '../../service/lang/language.service';

type OperatorId = 'all' | number;

interface VisibleDay {
  dayNum: number;
  label: string;
  date: Date;
}

@Component({
  selector: 'app-q-booking-services',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './q-booking-services.html',
  styleUrls: ['./q-booking-services.css'],
})
export class QBookingServices implements OnDestroy, OnInit {
  private headerPath = inject(HeaderPathService);

  // ===== Global search (strips) =====
  searchStripMode = false;
  globalSearchResults: TicketSearchResultDto[] = [];
  globalSearchQuery = '';
  selectedSearchTicket: TicketSearchResultDto | null = null;
  searchPopupOpen = false;

  // ===== Doctor search (local) =====
  doctorSearchMode = false;
  doctorSearchResults: any[] = [];

  constructor(
    public sch: ScheduleServices,
    private router: Router,
    private route: ActivatedRoute,
    private bus: TicketSearchBusService,
    private ticketReservation: TicketReservation,
    private globalConfig: GlobalConfigService,
    private toast: AppToastService,
    private languageService: LanguageService // ✅
  ) {
    this.buildVisibleDays();
    this.globalConfig.load().catch(() => {});

    this.navSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.reloadIfReady());

    this.busSub = this.sch.scheduleChanged$.subscribe(() => {});

    this.globalSearchSub = this.bus.results$.subscribe(({ items, term }) =>
      this.onGlobalResultsReceived(items, term)
    );
  }

  // ✅ Helpers للغة
  get lang() {
    return this.languageService.lang;
  }

  isAr(): boolean {
    return this.languageService.lang() === 'ar';
  }

  ngOnInit() {
    const qp = this.route.snapshot.queryParamMap;
    const qpBranchId = Number(qp.get('branchId') || 0);
    const qpClinicId = Number(qp.get('clinicId') || 0);
    const qpDoctorId = Number(qp.get('doctorId') || 0);
    const qpSearch = qp.get('search') || '';
    const savedSearch = localStorage.getItem('qbook.search') || '';
    const savedDoctorId = Number(localStorage.getItem('qbook.doctorId') || 0);
    const savedBranchId = Number(localStorage.getItem('qbook.branchId') || 0);
    const savedClinicId = Number(localStorage.getItem('qbook.clinicId') || 0);
    this.filter.searchQuery = savedSearch;
    if (savedDoctorId) {
      this.filter.operatorId = savedDoctorId as OperatorId;
    } else {
      this.filter.operatorId = 'all';
    }
    if (!savedBranchId) {
      return;
    }

    this.onBranchChange(savedBranchId);
    this.filter.searchQuery = savedSearch;

    let retries = 0;
    const maxRetries = 40;

    const interval = setInterval(() => {
      retries++;

      if (!this.sch.clinics || this.sch.clinics.length === 0) {
        if (retries > maxRetries) clearInterval(interval);
        return;
      }

      clearInterval(interval);

      if (savedClinicId) {
        const clinic =
          this.sch.clinics.find((c) => c.id === savedClinicId) || this.sch.clinics[0] || null;
        if (clinic) {
          this.sch.setSelectedClinic(clinic.id);
          localStorage.setItem('qbook.clinicId', String(clinic.id));
        }
      }

      if (savedDoctorId) {
        this.filter.operatorId = savedDoctorId as OperatorId;
        this.sch.setSelectedDoctor(savedDoctorId);
        localStorage.setItem('qbook.doctorId', String(savedDoctorId));
      } else {
        this.filter.operatorId = 'all';
        this.sch.setSelectedDoctor(null);
        localStorage.removeItem('qbook.doctorId');
      }
      this.buildVisibleDays();
      this.updateHeaderPath();
      this.reloadIfReady();
    }, 100);
  }

  editSearchTicket(t: TicketSearchResultDto) {
    let clinic =
      this.sch.clinics.find(
        (c) => c.name && c.name.toString().trim() === (t.serviceParentName || '').toString().trim()
      ) || null;

    if (!clinic && this.sch.clinics.length) {
      clinic = this.sch.clinics[0];
    }

    const clinicId: number | null = clinic?.id ?? null;
    const doctorId: number | null = t.serviceId || null;

    if (!clinicId || !doctorId) {
      console.warn('Missing clinicId or doctorId for ticket search result', t);
      this.toast.error(
        this.isAr()
          ? 'لا يمكن فتح التذكرة لعدم توفر بيانات العيادة أو الطبيب.'
          : 'Cannot open this ticket because clinic or doctor data is missing.'
      );
      return;
    }

    const dateObj = new Date(t.reservationDate);
    const dayKey = this.formatDateKey(dateObj);

    this.router.navigate(['/patient/received', clinicId, doctorId, dayKey, t.id]);
  }

  ngOnDestroy() {
    this.navSub?.unsubscribe();
    this.busSub?.unsubscribe();
    this.globalSearchSub?.unsubscribe();
  }

  // ===== Helpers for dates   =====
  private normalizeDateOnly(value: string | Date | null | undefined): Date | null {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private isSameDate(dateInput: string | Date | null | undefined): boolean {
    const d = this.normalizeDateOnly(dateInput);
    if (!d) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  }

  private isPastDate(dateInput: string | Date | null | undefined): boolean {
    const d = this.normalizeDateOnly(dateInput);
    if (!d) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
  }

  getStatusLabel(r: TicketSearchResultDto): string {
    if (!r.isActive && this.isPastDate(r.reservationDate)) {
      return this.isAr() ? 'لم يحضر' : 'Missed';
    }
    if (r.isActive) {
      return this.isAr() ? 'نشط' : 'Active';
    }
    return this.isAr() ? 'غير نشط' : 'Inactive';
  }

  getStatusClass(r: TicketSearchResultDto): string {
    if (r.isActive) {
      return 'bg-success text-white';
    }
    if (this.isPastDate(r.reservationDate)) {
      return 'bg-warning text-dark';
    }
    return 'bg-secondary text-light';
  }

  // ===== Global Search handling (list of strips) =====
  private onGlobalResultsReceived(items: TicketSearchResultDto[], term: string) {
    this.globalSearchResults = items || [];
    this.globalSearchQuery = term;
    this.searchStripMode = this.globalSearchResults.length > 0;
    this.searchPopupOpen = false;
  }

  exitSearchMode() {
    this.searchStripMode = false;
    this.globalSearchResults = [];
    this.globalSearchQuery = '';
    this.selectedSearchTicket = null;
    this.searchPopupOpen = false;
  }

  openSearchTicketPopup(item: TicketSearchResultDto) {
    this.selectedSearchTicket = item;
    this.searchPopupOpen = true;
  }

  closeSearchTicketPopup() {
    this.searchPopupOpen = false;
  }

  async printSearchTicket(t: TicketSearchResultDto) {
    if (!this.isSameDate(t.reservationDate)) {
      this.toast.warning(
        this.isAr()
          ? 'لا يمكن طباعة التذكرة إلا في يوم الحجز نفسه.'
          : 'Tickets can only be printed on the same reservation day.'
      );
      return;
    }

    await this.printByReservationId(t.id);
  }

  private async printByReservationId(reservationId: number) {
    try {
      const blob = await this.ticketReservation.printFromReservation(reservationId).toPromise();
      if (!blob) return;

      console.log('print blob type:', blob.type, 'size:', blob.size);

      let dto: any = null;
      try {
        const txt = await blob.text();
        const parsed = JSON.parse(txt);

        dto = parsed?.response ?? parsed?.item ?? parsed;

        console.log('parsed ticket dto:', dto);
      } catch {
        dto = null;
      }

      if (dto && dto.number) {
        const inner = this.buildLegacyTicketHtml(dto as TicketPrintDto);
        this.openPreviewWindow(`#${dto.number}`, inner, { autoPrint: true });
        return;
      }

      const contentType = (blob.type || '').toLowerCase();

      if (contentType.includes('pdf')) {
        const url = URL.createObjectURL(blob);
        this.openPreviewWindow(
          this.isAr() ? 'معاينة التذكرة' : 'Ticket Preview',
          `<iframe id="pdfFrame" src="${url}" style="border:0;width:100%;height:100vh"></iframe>`,
          { autoPrint: true }
        );
        return;
      }

      const url = URL.createObjectURL(blob);
      this.openPreviewWindow(
        this.isAr() ? 'معاينة التذكرة' : 'Ticket Preview',
        `<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#fff">
          <img src="${url}" style="max-width:100%;max-height:100%" />
        </div>`,
        { autoPrint: true }
      );
    } catch (err) {
      console.error('Print error', err);
      this.toast.error(
        this.isAr() ? 'فشل في فتح معاينة الطباعة.' : 'Failed to open print preview.'
      );
    }
  }

  private openPreviewWindow(title: string, bodyInnerHtml: string, opts?: { autoPrint?: boolean }) {
    const w = window.open('', '_blank', 'width=720,height=900');
    if (!w) return;

    const css = `
      *{box-sizing:border-box}
      html,body{margin:0;font-family:"Tajawal","Segoe UI",Arial;-webkit-font-smoothing:antialiased}
      .toolbar{
        position:fixed;top:0;left:0;right:0;background:#111;color:#fff;
        padding:8px 12px;display:flex;gap:8px;align-items:center;z-index:10
      }
      .toolbar .title{font-weight:700;margin-inline-end:auto}
      .toolbar button{border:0;padding:6px 12px;border-radius:8px;font-weight:700;cursor:pointer}
      .btn-print{background:#22c55e;color:#fff}
      .btn-close{background:#ef4444;color:#fff}

      .content{display:flex;justify-content:center}
      .print-wrap{display:flex;justify-content:center;width:100%}
      .print-page{
        width:80mm; background:#fff;
        page-break-inside:avoid;break-inside:avoid;
      }

      @media print{
        @page { size:80mm auto; margin:0 }   
        .toolbar{display:none}
        html,body{width:80mm}
        .print-page{width:80mm;padding:0}    
        img{print-color-adjust:exact;-webkit-print-color-adjust:exact}
      }
    `;

    const printScript = `
      <script>
        (function(){
          function waitImages(){
            const imgs=[...document.images];
            return Promise.all(imgs.map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=i.onerror=r;})));
          }
          async function ready(){ try{await waitImages();}catch{} }
          ${
            opts?.autoPrint === false
              ? ''
              : `if(document.readyState==="complete") ready(); else addEventListener('load',ready,{once:true});`
          }
        })();
      <\/script>
    `;

    w.document.open();
    w.document.write(`
      <html lang="${this.isAr() ? 'ar' : 'en'}" dir="${this.isAr() ? 'rtl' : 'ltr'}">
        <head>
          <meta charset="utf-8"/><title>${title}</title>
          <style>${css}</style>
        </head>
        <body>
          <div class="toolbar">
            <div class="title">${title}</div>
            <button class="btn-print" onclick="print()">${this.isAr() ? 'طباعة' : 'Print'}</button>
            <button class="btn-close" onclick="close()">${this.isAr() ? 'إغلاق' : 'Close'}</button>
          </div>
          <div class="content">
            <div class="print-wrap">
              <div class="print-page">
                ${bodyInnerHtml}
              </div>
            </div>
          </div>
          ${printScript}
        </body>
      </html>
    `);
    w.document.close();
  }

  private makeAbsoluteUrl(src: string | null | undefined): string {
    if (!src) return '';

    if (/^(https?:)?\/\//i.test(src) || /^(data|blob|file):/i.test(src)) {
      return src;
    }

    const trimmed = src.trim();
    const looksLikeRawBase64 = /^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length > 100;
    if (looksLikeRawBase64) {
      return `data:image/png;base64,${trimmed}`;
    }

    const origin = window.location.origin.replace(/\/+$/, '');
    const path = String(src).replace(/^\/+/, '');
    return `${origin}/${path}`;
  }

  private buildLegacyTicketHtml(dto: TicketPrintDto): string {
    const orgLogo = this.makeAbsoluteUrl(this.globalConfig.orgLogo());

    const doctorName = dto.serviceArabicName || dto.serviceEnglishName || '';

    const clinicName = dto.parentServiceArabicName || dto.parentServiceEnglishName || '';

    const branch = dto.branchNameAr || dto.branchNameEn || dto.branchName || '';

    const wait = dto.waitingCount ?? 0;
    const avgWait = dto.averageWaitingTime;
    const phone = dto.customerInput || '';

    return `
    <style>
      html, body {
        margin: 0;
        padding: 0;
        font-family: "Tajawal","Segoe UI",Arial,sans-serif;
        -webkit-font-smoothing: antialiased;
        color: #000;
        background: #fff;
      }

      .ticket {
        margin: 0 auto;
        padding: 0 0 2mm 0;
        background: #fff;
        page-break-inside: avoid;
        break-inside: avoid;
        text-align: center;
      }

      .logo { margin: 2mm 0 2mm; }
      .logo img {
        display: block;
        margin: 0 auto;
        max-width: 70mm;
        max-height: 55mm;
      }

      .header {
        display: flex;
        justify-content: space-between;
        font-size: 11pt;
        color: #444;
        padding: 0 6mm;
        margin: 1mm 0 4mm;
      }

      .patient {
        font-size: 14pt;
        font-weight: 800;
        line-height: 1.3;
        margin-bottom: 1mm;
      }

      .clinic {
        font-size: 10pt;
        font-weight: 400;
        line-height: 1.3;
        margin-bottom: 1.5mm;
      }

      .num {
        font-size: 27pt;
        font-weight: 700;
        margin: 1mm 0 -5mm;
        letter-spacing: .5pt;
      }

      .info {
        text-align: right;
        width: 90%;
        margin: 0 auto 3mm;
        font-size: 10pt;
        line-height: 1.6;
      }
      .label { font-weight: 700; }
      .value { font-weight: normal; }

      .site {
        margin: 0 auto;
        text-align: center;
        border-top: 1px solid #000;
      }
      .site-border {
        width: 100%;
        height: 1px;
        background: #000;
        margin: 2mm 0 1.5mm 0;
        display: block;
      }
      .site-text {
        font-size: 9pt;
        font-weight: 500;
        color: #000;
        direction: ltr;
        letter-spacing: .3pt;
      }

      @page { size: 80mm auto; margin: 0; }

      @media print {
        html, body { width: 80mm; margin: 0; padding: 0; }
        .ticket    { width: 80mm; margin: 0; padding: 0 0 2mm 0; }
        img { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }
    </style>

    <div class="ticket">
      <div class="logo">
        <img src="${orgLogo}" alt="logo" />
      </div>

      <div class="header">
        <span style="color:#000; margin-right: 20px">${dto.printTime ?? ''}</span>
        <span style="color:#000; margin-left: 20px">${dto.printDate ?? ''}</span>
      </div>

      <div class="clinic">${clinicName}</div>
      <div class="patient">د / ${doctorName} </div>

      <br />
      <div class="num">${dto.number ?? ''}</div>
      <br />
      ${phone ? `<div><span class="value">${phone}</span></div>` : ''}
      <br />
      <div class="info">
        <div>
          <span class="label">الفرع: </span>
          <span class="value">${branch}</span>
        </div>

        <div>
          <span class="label">عملاء منتظرين: </span>
          <span class="value">${wait}</span>
        </div>

        ${
          avgWait != null
            ? `<div><span class="label">متوسط وقت الانتظار: </span> <span class="value">${avgWait} دقيقة</span></div>`
            : ''
        }
      </div>

      <div class="site">
        <div class="site-text">www.Niletronix.com</div>
      </div>
    </div>
    `;
  }

  private navSub: any;
  private busSub: any;
  private globalSearchSub: any;

  selectedBranchId: number | null = null;
  selectedBranchPath = '';

  filter = {
    searchQuery: '',
    operatorId: 'all' as OperatorId,
  };

  private readonly today = new Date();
  viewYear = this.today.getFullYear();
  viewMonth = this.today.getMonth();

  visibleDays: VisibleDay[] = [];
  private searchTimer: number | null = null;

  @HostListener('window:keydown', ['$event'])
  handleMonthKeyboardNav(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const tag = (target.tagName || '').toLowerCase();
    const isTextInput =
      tag === 'input' ||
      tag === 'textarea' ||
      target.isContentEditable ||
      target.getAttribute('role') === 'textbox';

    if (isTextInput) return;

    if (event.key === 'ArrowRight') this.nextMonth();
    else if (event.key === 'ArrowLeft') this.prevMonth();
  }

  get branches(): Branch[] {
    return this.sch.branches();
  }

  onBranchChange(id: number | null) {
    this.selectedBranchId = id;
    this.sch.setSelectedBranch(id);
    this.sch.setSelectedClinic(null);
    this.sch.setSelectedDoctor(null);

    this.filter.operatorId = 'all';
    this.filter.searchQuery = '';

    const br = this.branches.find((b) => b.id === id) || null;
    const branchName = br?.name ?? '';
    this.selectedBranchPath = branchName;
    this.headerPath.setBranchPath(branchName);

    this.updateHeaderPath?.();

    if (id) {
      localStorage.setItem('qbook.branchId', String(id));
    } else {
      localStorage.removeItem('qbook.branchId');
    }

    localStorage.removeItem('qbook.clinicId');
    localStorage.removeItem('qbook.doctorId');
    localStorage.removeItem('qbook.search');

    this.reloadIfReady();
  }

  get clinicsLoading(): boolean {
    return typeof this.sch.clinicsLoading === 'function' ? this.sch.clinicsLoading() : false;
  }

  onSpecializationChange(id: number | null) {
    if (!this.sch.selectedBranchId()) return;

    this.sch.setSelectedClinic(id);
    this.filter.operatorId = 'all';
    this.sch.setSelectedDoctor(null);

    if (id) {
      localStorage.setItem('qbook.clinicId', String(id));
    } else {
      localStorage.removeItem('qbook.clinicId');
      localStorage.removeItem('qbook.doctorId');
    }

    this.reloadIfReady();
  }

  private reloadIfReady() {
    let clinicId = this.sch.selectedClinicId();
    const term = (this.filter.searchQuery || '').trim();

    if (!clinicId && term && this.sch.clinics.length) {
      clinicId = this.sch.clinics[0].id;
      this.sch.setSelectedClinic(clinicId);
      this.updateHeaderPath();
    }

    if (!clinicId) return;

    this.sch.loadSchedule(clinicId, this.viewYear, this.viewMonth + 1, term);
  }

  private updateHeaderPath() {
    const clinicName = this.selectedClinicName;
    const placeholder = this.isAr() ? 'اختر تخصصًا' : 'Select a specialization';
    const extra = clinicName && clinicName !== placeholder ? `/ ${clinicName}` : '';
    this.headerPath.setExtraPath(extra);
  }

  get hasAnySelection(): boolean {
    return (
      !!this.sch.selectedBranchId() ||
      !!this.sch.selectedClinicId() ||
      this.filter.operatorId !== 'all' ||
      !!(this.filter.searchQuery && this.filter.searchQuery.trim())
    );
  }

  get hasActiveFilters(): boolean {
    return (
      (this.filter.searchQuery && this.filter.searchQuery.trim().length > 0) ||
      this.filter.operatorId !== 'all'
    );
  }

  resetFilters(triggerReload: boolean = true) {
    this.filter = {
      searchQuery: '',
      operatorId: 'all',
    };
    this.sch.setSelectedDoctor(null);

    this.selectedBranchId = null;
    this.sch.setSelectedBranch(null);
    this.sch.setSelectedClinic(null);
    this.sch.setSelectedDoctor(null);
    localStorage.removeItem('qbook.search');
    localStorage.removeItem('qbook.doctorId');
    this.doctorSearchMode = false;
    this.doctorSearchResults = [];
    this.searchStripMode = false;
    this.globalSearchResults = [];
    this.globalSearchQuery = '';
    this.selectedSearchTicket = null;
    this.searchPopupOpen = false;

    localStorage.removeItem('qbook.branchId');
    localStorage.removeItem('qbook.clinicId');
    localStorage.removeItem('qbook.doctorId');
    localStorage.removeItem('qbook.search');
    this.headerPath.clearBranchPath?.();
    this.headerPath.clearDoctorPath?.();
    this.headerPath.clearExtra?.();

    if (triggerReload) {
      this.reloadIfReady();
    }
  }

  onOperatorChange(id: OperatorId) {
    this.filter.operatorId = id;

    if (id === 'all') {
      this.sch.setSelectedDoctor(null);
      localStorage.removeItem('qbook.doctorId');
    } else {
      const numId = id as number;
      this.sch.setSelectedDoctor(numId);
      localStorage.setItem('qbook.doctorId', String(numId));
    }
  }

  onSearchChange(term: string) {
    this.filter.searchQuery = term ?? '';

    if (this.searchTimer) clearTimeout(this.searchTimer);

    const trimmed = (term || '').trim();

    if (trimmed) {
      localStorage.setItem('qbook.search', trimmed);
    } else {
      localStorage.removeItem('qbook.search');
    }

    if (!trimmed) {
      this.doctorSearchMode = false;
      this.doctorSearchResults = [];
      return;
    }

    this.searchTimer = window.setTimeout(() => {
      this.doDoctorSearch(trimmed);
    }, 300);
  }

  doDoctorSearch(term: string) {
    const trimmed = (term || '').trim();
    if (!trimmed) {
      this.doctorSearchResults = [];
      this.doctorSearchMode = false;
      return;
    }

    this.sch.doctorSearch(trimmed).subscribe({
      next: (res: any) => {
        const items = Array.isArray(res) ? res : Array.isArray(res?.response) ? res.response : [];

        this.doctorSearchResults = items;
        this.doctorSearchMode = this.doctorSearchResults.length > 0;

        if (!this.doctorSearchResults.length) {
          this.toast.info(
            this.isAr()
              ? 'لا توجد نتائج مطابقة لاسم الطبيب المدخل.'
              : 'No doctors match the entered name.'
          );
        }
      },
      error: () => {
        this.doctorSearchResults = [];
        this.doctorSearchMode = false;
        this.toast.error(
          this.isAr()
            ? 'حدث خطأ أثناء البحث عن الأطباء.'
            : 'An error occurred while searching for doctors.'
        );
      },
    });
  }

  openDoctorFromSearch(item: any) {
    this.doctorSearchMode = false;
    this.filter.searchQuery = '';

    const branchId: number | null = item.branchId ?? null;
    if (!branchId) {
      console.warn('branchId is missing on doctor search result', item);
      return;
    }

    this.sch.setSelectedBranch(branchId);
    localStorage.setItem('qbook.branchId', String(branchId));

    const branch = this.branches.find((b) => b.id === branchId) || null;
    const branchName = branch?.name ?? (item.branchNameAr || item.branchNameEn || '');
    this.selectedBranchPath = branchName;
    this.headerPath.setBranchPath(branchName);

    const clinicIdFromDto: number | null = item.parentId ?? null;
    const parentName: string = (item.parentServiceArabicName || item.parentServiceEnglishName || '')
      .toString()
      .trim();

    const doctorId: number | null = item.serviceId ?? null;
    const doctorName: string = (item.serviceArabicName || item.serviceEnglishName || '')
      .toString()
      .trim();

    this.headerPath.setDoctorPath(doctorName);

    let retries = 0;
    const maxRetries = 40;

    const interval = setInterval(() => {
      retries++;

      if (!this.sch.clinics || this.sch.clinics.length === 0) {
        if (retries > maxRetries) {
          clearInterval(interval);
          console.warn('Clinics not loaded for branch', branchId);
        }
        return;
      }

      let clinic =
        ((clinicIdFromDto && this.sch.clinics.find((c) => c.id === clinicIdFromDto)) ||
          this.sch.clinics.find((c) => c.name && c.name.toString().trim() === parentName) ||
          this.sch.clinics[0]) ??
        null;

      clearInterval(interval);

      if (!clinic) {
        console.warn('No clinic found for doctor search item', item);
        return;
      }

      this.sch.setSelectedClinic(clinic.id);
      localStorage.setItem('qbook.clinicId', String(clinic.id));

      if (doctorId) {
        this.filter.operatorId = doctorId as OperatorId;
        this.sch.setSelectedDoctor(doctorId);
        localStorage.setItem('qbook.doctorId', String(doctorId));
      } else {
        this.filter.operatorId = 'all';
        this.sch.setSelectedDoctor(null);
        localStorage.removeItem('qbook.doctorId');
      }

      this.updateHeaderPath?.();
      this.reloadIfReady();

      setTimeout(() => {
        const el = document.querySelector('.schedule-table');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 400);
    }, 100);
  }

  get selectedClinic() {
    const id = this.sch.selectedClinicId();
    return id ? this.sch.clinics.find((c) => c.id === id) ?? null : null;
  }

  get selectedClinicName(): string {
    return this.selectedClinic?.name ?? (this.isAr() ? 'اختر تخصصًا' : 'Select a specialization');
  }

  private get selectedClinicDoctorsInternal(): Doctor[] {
    const id = this.sch.selectedClinicId();
    return id ? this.sch.getDoctorsByClinic(id) : [];
  }

  get filteredClinicDoctors(): Doctor[] {
    const docs = this.selectedClinicDoctorsInternal;
    const q = this.filter.searchQuery.trim().toLowerCase();

    return docs.filter((d) => {
      if (q && !d.name.toLowerCase().includes(q)) return false;
      if (this.filter.operatorId !== 'all' && this.filter.operatorId !== d.id) return false;
      return true;
    });
  }

  get monthLabel(): string {
    const date = new Date(this.viewYear, this.viewMonth, 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }

  private get startDayForView(): number {
    if (this.viewYear === this.today.getFullYear() && this.viewMonth === this.today.getMonth()) {
      return this.today.getDate();
    }
    return 1;
  }

  private buildVisibleDays() {
    const daysInMonth = new Date(this.viewYear, this.viewMonth + 1, 0).getDate();
    const start = this.startDayForView;
    const result: VisibleDay[] = [];

    for (let d = start; d <= daysInMonth; d++) {
      const date = new Date(this.viewYear, this.viewMonth, d);
      const label = date.toLocaleDateString('en-US', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      });
      result.push({ dayNum: d, label, date });
    }
    this.visibleDays = result;
  }

  prevMonth() {
    if (this.viewMonth === 0) {
      this.viewMonth = 11;
      this.viewYear -= 1;
    } else {
      this.viewMonth -= 1;
    }
    this.buildVisibleDays();
    this.reloadIfReady();
  }

  nextMonth() {
    if (this.viewMonth === 11) {
      this.viewMonth = 0;
      this.viewYear += 1;
    } else {
      this.viewMonth += 1;
    }
    this.buildVisibleDays();
    this.reloadIfReady();
  }

  counts(clinicId: number, doctorId: number, day: VisibleDay): DayStats {
    return this.sch.countsFor(clinicId, doctorId, day.date);
  }

  private formatDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  onReservedClick(clinicId: number, doctor: Doctor, day: VisibleDay) {
    if (!clinicId || !doctor?.id) return;

    this.sch.setSelectedClinic(clinicId);
    this.sch.setSelectedDoctor(doctor.id);
    localStorage.setItem('qbook.clinicId', String(clinicId));
    localStorage.setItem('qbook.doctorId', String(doctor.id));

    const dayKey = this.formatDateKey(day.date);
    this.router.navigate(['/patient/received', clinicId, doctor.id, dayKey]);
  }

  onAvailableClick(clinicId: number, doctor: Doctor, day: VisibleDay) {
    if (!clinicId || !doctor?.id) return;

    this.sch.setSelectedClinic(clinicId);
    this.sch.setSelectedDoctor(doctor.id);
    localStorage.setItem('qbook.clinicId', String(clinicId));
    localStorage.setItem('qbook.doctorId', String(doctor.id));

    const dayKey = this.formatDateKey(day.date);
    this.router.navigate(['/patient/available', clinicId, doctor.id, dayKey]);
  }

  isMissedTicket(r: TicketSearchResultDto): boolean {
    return !r.isActive && this.isPastDate(r.reservationDate);
  }

  isTicketActionsDisabled(r: TicketSearchResultDto): boolean {
    return !r.isActive && this.isSameDate(r.reservationDate);
  }

  trackByDay = (_: number, day: VisibleDay) => day.dayNum;
  trackByDoctor = (_: number, d: Doctor) => d.id;
}
